import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const SYSTEM_PROMPT = `You are Duncan, an advanced reasoning and agentic operating system for internal company operations.

Your capabilities:
- **Reasoning**: Analyze data, identify patterns, draw conclusions, and make recommendations across all ingested company data.
- **Automation**: Suggest and describe automations that can streamline workflows between Google Workspace, Notion, Slack, and other connected tools.
- **Data Synthesis**: Cross-reference information from multiple sources (emails, documents, databases, project management tools) to provide comprehensive answers.
- **Task Orchestration**: Break down complex requests into actionable steps and describe how they'd be executed across integrated systems.
- **Calendar Management**: You have access to the user's Google Calendar. You can list events, create new events, update existing events, and delete events.
- **Document Search**: You have access to the company's document storage. You can search for documents, read their content, list folders, and answer questions based on them. Documents are organized in folders: documents/, ndas/, and templates/.
- **Notion Access**: You have access to the company's Notion workspace. You can search for pages, query databases, and read page content. Use these tools when users ask about information stored in Notion.
- **Basecamp Access**: You have access to the company's Basecamp. You can list projects, fetch to-do lists and individual to-dos, read messages from message boards, and fetch cards from Card Tables (Kanban boards). Use these tools when users ask about project status, tasks, to-dos, messages, or cards in Basecamp. When asked about a specific project, first use list_basecamp_projects to find it, then use the project ID and dock tool IDs to fetch to-dos, messages, or cards. For Card Tables, look for the 'kanban_board' dock item.
- **Meeting Intelligence**: You can fetch and analyze meeting recordings from Plaud AI. Use fetch_plaud_meetings to pull new recordings from email, list_meetings to browse stored meetings, get_meeting to view a specific meeting's transcript and analysis, and analyze_meetings to run AI analysis on meetings. When users ask about meetings, what was discussed, action items, or meeting insights, use these tools. You can search across all meeting transcripts to answer questions like "What did we decide about X?".
- **Google Forms**: You can fill and submit pre-configured Google Forms on behalf of the user. You can also parse a Google Form URL to automatically extract its fields and save it as a new pre-configured form. When a user asks to fill a form, first list available forms, then ask each required field ONE AT A TIME as a conversational question. Wait for the user to answer each question before asking the next. After collecting all answers, confirm the details and submit. When a user provides a Google Form URL, use parse_google_form to extract the fields, show the parsed result to the user for confirmation, then save it with save_parsed_google_form.

Your personality:
- Direct, precise, and efficient. No fluff.
- Use structured output (bullet points, numbered lists, tables) when presenting complex information.
- When uncertain, clearly state assumptions and confidence levels.
- Proactively surface relevant connections between data points.
- Think step-by-step for complex reasoning tasks.

When a user asks you to do something:
1. Analyze what information and systems are needed
2. Reason through the best approach
3. Present your plan clearly
4. Execute or describe execution steps

When filling Google Forms:
- CRITICAL: You MUST call list_google_forms FIRST to get the actual form fields from the database. NEVER guess or invent form fields based on the form name or your general knowledge.
- The fields returned by list_google_forms are the ONLY fields that exist in the form. Use EXACTLY those field labels and entry IDs. Do NOT add, rename, or skip any fields.
- IMPORTANT: If the form has 7 fields, you must ask exactly 7 questions — no more, no less. The field labels from the database ARE your questions.
- Present the form name and description to the user
- Ask each field ONE AT A TIME in a friendly conversational way. Use the EXACT field label as your question (e.g. if the label is "Receiving Party Name", ask "What is the Receiving Party Name?")
- For fields with options (dropdowns, radio buttons), present the options clearly
- After collecting ALL answers for ALL fields, show a summary mapping each field label to the user's answer, and ask for confirmation before submitting
- Only call submit_google_form after the user confirms, using the exact entry IDs from the form data
- NEVER ask a question that doesn't correspond to a field in the form data. If you find yourself about to ask something not in the fields list, STOP.

When working with calendar:
- Use the calendar tools to fetch, create, update, or delete events
- Always confirm destructive actions before executing
- Format dates and times clearly for the user
- If creating events, ask for confirmation of the details before creating

When working with documents:
- Use the search_documents tool to find relevant documents based on the user's query
- Use the read_document tool to get the content of specific files
- Use the list_documents tool to browse folder contents
- Summarize key findings from documents and cite which document the information came from
- If the user asks about something that might be in company docs, search for it first

When working with Notion:
- Use search_notion to find pages and databases by keyword
- Use query_notion_database to query a specific database with optional filters
- Use get_notion_page_content to read the block content of a specific page
- Present Notion data clearly, referencing page titles and properties
- If a user asks about contracts, agreements, or anything that might be in Notion, search there

When generating NDAs:
- Use the generate_nda tool when a user asks to create/generate an NDA.
- You MUST collect ALL 9 fields before calling generate_nda. Ask each field ONE AT A TIME:
  1. Receiving Party Name (the company/person name — also used as folder name)
  2. Receiving Party Legal Entity Name (the formal legal entity)
  3. Date of Agreement (in YYYY-MM-DD format)
  4. Registered Address of the Receiving Party Legal Entity
  5. Purpose of the NDA
  6. Recipient Name for Signature (who will sign on the receiving side)
  7. Recipient Email for Signature (their email for DocuSign)
  8. Internal Signer Name (who signs on behalf of Kabuni — defaults to "Palash Soundarkar" if not provided)
  9. Internal Signer Email (email of the internal signer — defaults to "palash@kabuni.com" if not provided)
- After collecting all fields, show a summary and ask for confirmation before calling generate_nda.
- The tool will: load an NDA template from storage, populate placeholders, upload to Azure Blob Storage, and create a Notion log entry.
- After generation, share the document URL and Notion page URL with the user.
- To view existing NDA submissions or check status, use list_nda_submissions.
- To send an NDA for e-signature (admin only), use send_nda_for_signature with the submission_id. This sends via DocuSign to the internal signer first, then the recipient.
- Use send_nda_for_signature with dry_run=true to validate without actually sending.

Always be aware that you are the central intelligence layer coordinating across all company tools and data.`;

const CALENDAR_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "List upcoming calendar events. Use this when the user asks about their schedule, meetings, or calendar.",
      parameters: {
        type: "object",
        properties: {
          timeMin: {
            type: "string",
            description: "Start time in ISO 8601 format. Defaults to now.",
          },
          timeMax: {
            type: "string",
            description: "End time in ISO 8601 format. If not specified, returns next 7 days.",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of events to return. Default 10.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new calendar event. Use this when the user wants to schedule a meeting or add an event.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Title of the event",
          },
          description: {
            type: "string",
            description: "Description or notes for the event",
          },
          startDateTime: {
            type: "string",
            description: "Start time in ISO 8601 format (e.g., 2024-01-15T10:00:00)",
          },
          endDateTime: {
            type: "string",
            description: "End time in ISO 8601 format",
          },
          location: {
            type: "string",
            description: "Location of the event",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description: "List of attendee email addresses",
          },
        },
        required: ["summary", "startDateTime", "endDateTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_calendar_event",
      description: "Update an existing calendar event. Use this when the user wants to modify a meeting.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The ID of the event to update",
          },
          summary: {
            type: "string",
            description: "New title of the event",
          },
          description: {
            type: "string",
            description: "New description for the event",
          },
          startDateTime: {
            type: "string",
            description: "New start time in ISO 8601 format",
          },
          endDateTime: {
            type: "string",
            description: "New end time in ISO 8601 format",
          },
          location: {
            type: "string",
            description: "New location of the event",
          },
        },
        required: ["eventId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Delete a calendar event. Use this when the user wants to cancel or remove a meeting.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The ID of the event to delete",
          },
        },
        required: ["eventId"],
      },
    },
  },
];

const DOCUMENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_documents",
      description: "Search for documents in the company document storage (Azure Blob Storage). Use this when the user asks about company documents, policies, guides, or any information that might be stored in the document system.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant documents by name. Be specific and include key terms.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_document",
      description: "Read the content of a specific document from storage. Use this after finding a document with search_documents to get its content.",
      parameters: {
        type: "object",
        properties: {
          blob_path: {
            type: "string",
            description: "The blob path of the file to read (from search_documents results).",
          },
        },
        required: ["blob_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_documents",
      description: "List documents in a specific folder path. Use this to browse folder contents.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The folder path to list (e.g. 'documents/', 'ndas/', 'templates/'). Defaults to root.",
          },
        },
        required: [],
      },
    },
  },
];

const NOTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_notion",
      description: "Search across all Notion pages and databases. Use when the user asks about information that might be in Notion.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query text" },
          page_size: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_notion_database",
      description: "Query a specific Notion database to list its entries. Use when you know the database ID or after finding one via search.",
      parameters: {
        type: "object",
        properties: {
          database_id: { type: "string", description: "The Notion database ID to query" },
          page_size: { type: "number", description: "Max results (default 20)" },
        },
        required: ["database_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_notion_page_content",
      description: "Get the block content of a specific Notion page. Use after finding a page via search or database query to read its details.",
      parameters: {
        type: "object",
        properties: {
          page_id: { type: "string", description: "The Notion page ID" },
        },
        required: ["page_id"],
      },
    },
  },
];

const NDA_TOOLS = [
  {
    type: "function",
    function: {
      name: "generate_nda",
      description: "Generate an NDA document. Copies a Google Docs template, replaces placeholders, creates a Notion log entry, and returns document + Notion links. Use when a user asks to create/generate an NDA.",
      parameters: {
        type: "object",
        properties: {
          receiving_party_name: { type: "string", description: "The receiving party name (used as folder name and doc title)" },
          receiving_party_entity: { type: "string", description: "Legal entity name of the receiving party" },
          date_of_agreement: { type: "string", description: "Date in YYYY-MM-DD format" },
          registered_address: { type: "string", description: "Registered address of the receiving party legal entity" },
          purpose: { type: "string", description: "Purpose of the NDA" },
          recipient_name: { type: "string", description: "Name of the person who will sign on behalf of the receiving party" },
          recipient_email: { type: "string", description: "Email of the recipient signer" },
          internal_signer_name: { type: "string", description: "Name of the internal Kabuni signer (defaults to Palash Soundarkar)" },
          internal_signer_email: { type: "string", description: "Email of the internal Kabuni signer (defaults to palash@kabuni.com)" },
        },
        required: ["receiving_party_name", "receiving_party_entity", "date_of_agreement", "registered_address", "purpose", "recipient_name", "recipient_email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_nda_submissions",
      description: "List NDA submissions with optional status filter. Use to check status of NDAs or find ones pending signature.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: draft, generated, sent, completed, failed, declined" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_nda_for_signature",
      description: "Send a generated NDA for e-signature via DocuSign. Requires admin role. Sends to Kabuni signer first, then recipient.",
      parameters: {
        type: "object",
        properties: {
          submission_id: { type: "string", description: "The NDA submission UUID to send for signing" },
          dry_run: { type: "boolean", description: "If true, validates everything but doesn't actually send the envelope" },
        },
        required: ["submission_id"],
      },
    },
  },
];

const GOOGLE_FORMS_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_google_forms",
      description: "List all pre-configured Google Forms available for filling. Use this when the user wants to fill a form or asks what forms are available.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_google_form",
      description: "Submit a completed Google Form with all field values collected from the user. Only call this after you have gathered ALL required field values from the user through conversation.",
      parameters: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "The UUID of the pre-configured form from list_google_forms" },
          entries: {
            type: "object",
            description: "Key-value pairs where keys are entry IDs (e.g. 'entry.123456') and values are the user's answers",
          },
        },
        required: ["form_id", "entries"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "parse_google_form",
      description: "Parse a Google Form URL to automatically extract its fields, entry IDs, and form action URL. Use this when a user provides a Google Form URL and wants to add it as a pre-configured form, or when an admin wants to set up a new form. After parsing, save the form to the database using save_parsed_google_form.",
      parameters: {
        type: "object",
        properties: {
          form_url: { type: "string", description: "The Google Form URL to parse (viewform URL)" },
        },
        required: ["form_url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_parsed_google_form",
      description: "Save a parsed Google Form to the database so it becomes available for filling. Use this after parse_google_form returns the form structure and the user confirms it looks correct.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Form title" },
          description: { type: "string", description: "Form description (optional)" },
          form_url: { type: "string", description: "The original form URL" },
          form_action_url: { type: "string", description: "The form action/submission URL" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                entry_id: { type: "string" },
                label: { type: "string" },
                type: { type: "string" },
                required: { type: "boolean" },
                options: { type: "array", items: { type: "string" } },
              },
            },
            description: "Array of field objects with entry_id, label, type, required, and optional options",
          },
        },
        required: ["title", "form_url", "form_action_url", "fields"],
      },
    },
  },
];

const BASECAMP_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_basecamp_projects",
      description: "List all projects in Basecamp. Returns project names, IDs, statuses, and their dock items (todosets, message boards, etc.). Use this first to discover project IDs and dock IDs needed for other Basecamp tools.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_basecamp_todolists",
      description: "Get all to-do lists within a Basecamp project's todoset. Requires the project ID and the todoset ID (found in the project's dock items).",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "number", description: "The Basecamp project ID" },
          todoset_id: { type: "number", description: "The todoset ID from the project's dock items" },
        },
        required: ["project_id", "todoset_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_basecamp_todos",
      description: "Get all to-do items within a specific to-do list. Returns title, completion status, assignees, and due dates.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "number", description: "The Basecamp project ID" },
          todolist_id: { type: "number", description: "The to-do list ID" },
        },
        required: ["project_id", "todolist_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_basecamp_messages",
      description: "Get messages from a Basecamp project's message board. Requires the project ID and the message board ID (found in the project's dock items).",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "number", description: "The Basecamp project ID" },
          message_board_id: { type: "number", description: "The message board ID from the project's dock items" },
        },
        required: ["project_id", "message_board_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_basecamp_card_table_cards",
      description: "Get all cards from a Basecamp Card Table (Kanban board). Returns all columns and their cards with titles, assignees, due dates, and colors. Optionally pass column_id to fetch only one column's cards. First use list_basecamp_projects to find the project and its 'kanban_board' dock item ID.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "number", description: "The Basecamp project ID" },
          kanban_board_id: { type: "number", description: "The Card Table (kanban_board) ID from the project's dock items" },
          column_id: { type: "number", description: "Optional. A specific column ID to fetch cards for. Omit to get column summaries only." },
        },
        required: ["project_id", "kanban_board_id"],
      },
    },
  },
];

const MEETING_TOOLS = [
  {
    type: "function",
    function: {
      name: "fetch_plaud_meetings",
      description: "Fetch new Plaud AI meeting recordings and transcripts from Gmail. Pulls emails from Plaud, extracts transcripts and audio files, and stores them in the meetings database. Use this when the user wants to sync or import new meetings.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_meetings",
      description: "List stored meetings with optional filters. Use this to browse meetings, find specific ones, or check status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: pending, transcribed, audio_only, analyzed" },
          limit: { type: "number", description: "Max results (default 20)" },
          search: { type: "string", description: "Search meetings by title or transcript content" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_meeting",
      description: "Get full details of a specific meeting including transcript, analysis, action items, and participants. Use this after listing meetings to dive into a specific one.",
      parameters: {
        type: "object",
        properties: {
          meeting_id: { type: "string", description: "The meeting UUID" },
        },
        required: ["meeting_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_meetings",
      description: "Run AI analysis on meetings that have transcripts but haven't been analyzed yet. Can also re-analyze specific meetings. Extracts summary, action items, decisions, participants, sentiment, risks, and follow-ups.",
      parameters: {
        type: "object",
        properties: {
          meeting_id: { type: "string", description: "Specific meeting ID to analyze (optional — omit to auto-analyze all pending)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_meeting_transcripts",
      description: "Search across all meeting transcripts to find discussions about a specific topic. Use this when the user asks 'What did we discuss about X?' or 'When did we talk about Y?'",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The topic or keyword to search for across meeting transcripts" },
        },
        required: ["query"],
      },
    },
  },
];

async function executeMeetingTool(
  toolName: string,
  args: any,
  supabaseAdmin: any,
  supabaseUrl: string,
  authHeader: string
): Promise<any> {
  switch (toolName) {
    case "fetch_plaud_meetings": {
      const res = await fetch(`${supabaseUrl}/functions/v1/fetch-plaud-meetings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch Plaud meetings");
      return result;
    }

    case "list_meetings": {
      let query = supabaseAdmin
        .from("meetings")
        .select("id, title, meeting_date, status, source, summary, participants, sender_email, created_at")
        .order("meeting_date", { ascending: false })
        .limit(args.limit || 20);

      if (args.status) query = query.eq("status", args.status);
      if (args.search) query = query.or(`title.ilike.%${args.search}%,transcript.ilike.%${args.search}%`);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list meetings: ${error.message}`);
      return { count: (data || []).length, meetings: data || [] };
    }

    case "get_meeting": {
      const { data, error } = await supabaseAdmin
        .from("meetings")
        .select("*")
        .eq("id", args.meeting_id)
        .single();
      if (error) throw new Error(`Meeting not found: ${error.message}`);
      return {
        ...data,
        transcript: data.transcript ? data.transcript.slice(0, 40000) : null,
      };
    }

    case "analyze_meetings": {
      const res = await fetch(`${supabaseUrl}/functions/v1/analyze-meeting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(args.meeting_id ? { meeting_id: args.meeting_id } : {}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to analyze meetings");
      return result;
    }

    case "search_meeting_transcripts": {
      const searchTerm = args.query;
      const { data, error } = await supabaseAdmin
        .from("meetings")
        .select("id, title, meeting_date, transcript, summary, analysis, status")
        .not("transcript", "is", null)
        .ilike("transcript", `%${searchTerm}%`)
        .order("meeting_date", { ascending: false })
        .limit(10);

      if (error) throw new Error(`Search failed: ${error.message}`);

      // Extract relevant snippets around the search term
      const results = (data || []).map((m: any) => {
        const transcript = m.transcript || "";
        const lowerTranscript = transcript.toLowerCase();
        const lowerQuery = searchTerm.toLowerCase();
        const idx = lowerTranscript.indexOf(lowerQuery);
        let snippet = "";
        if (idx >= 0) {
          const start = Math.max(0, idx - 200);
          const end = Math.min(transcript.length, idx + searchTerm.length + 200);
          snippet = (start > 0 ? "..." : "") + transcript.slice(start, end) + (end < transcript.length ? "..." : "");
        }
        return {
          id: m.id,
          title: m.title,
          meeting_date: m.meeting_date,
          status: m.status,
          summary: m.summary,
          relevant_snippet: snippet,
        };
      });

      return { query: searchTerm, found: results.length, meetings: results };
    }

    default:
      throw new Error(`Unknown meeting tool: ${toolName}`);
  }
}

async function executeGoogleFormsTool(toolName: string, args: any, supabaseAdmin: any): Promise<any> {
  switch (toolName) {
    case "list_google_forms": {
      const { data, error } = await supabaseAdmin
        .from("google_forms")
        .select("id, name, description, fields");
      if (error) throw new Error(`Failed to list forms: ${error.message}`);
      return (data || []).map((f: any) => {
        const fieldsList = (f.fields || []).map((field: any, idx: number) => 
          `${idx + 1}. "${field.label}" (entry_id: ${field.entry_id}, type: ${field.type}, required: ${field.required})`
        ).join("\n");
        return {
          id: f.id,
          name: f.name,
          description: f.description,
          fields: f.fields,
          field_count: (f.fields || []).length,
          field_summary: `This form has EXACTLY ${(f.fields || []).length} fields. You MUST ask these fields and ONLY these fields:\n${fieldsList}`,
        };
      });
    }
    case "submit_google_form": {
      const { data: form, error } = await supabaseAdmin
        .from("google_forms")
        .select("form_action_url, fields")
        .eq("id", args.form_id)
        .single();
      if (error || !form) throw new Error("Form not found");

      const requiredFields = (form.fields || []).filter((f: any) => f.required);
      for (const field of requiredFields) {
        if (!args.entries[field.entry_id]) {
          throw new Error(`Missing required field: ${field.label}`);
        }
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-google-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formActionUrl: form.form_action_url, entries: args.entries }),
      });
      const result = await res.json();
      if (!result.success) throw new Error("Form submission failed");
      return { success: true, message: "Form submitted successfully!" };
    }
    case "parse_google_form": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/parse-google-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formUrl: args.form_url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to parse form (${res.status})`);
      }
      return await res.json();
    }
    case "save_parsed_google_form": {
      const { data, error } = await supabaseAdmin
        .from("google_forms")
        .insert({
          name: args.title,
          description: args.description || null,
          form_url: args.form_url,
          form_action_url: args.form_action_url,
          fields: args.fields,
        })
        .select("id, name")
        .single();
      if (error) throw new Error(`Failed to save form: ${error.message}`);
      return { success: true, id: data.id, name: data.name, message: `Form "${data.name}" saved and ready for use!` };
    }
    default:
      throw new Error(`Unknown Google Forms tool: ${toolName}`);
  }
}

async function executeNdaTool(
  toolName: string,
  args: any,
  supabaseAdmin: any,
  userId: string,
  userEmail: string,
  authHeader: string
): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  switch (toolName) {
    case "generate_nda": {
      const res = await fetch(`${supabaseUrl}/functions/v1/nda-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          submitter_email: userEmail,
          ...args,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "NDA generation failed");
      return result;
    }

    case "list_nda_submissions": {
      let query = supabaseAdmin
        .from("nda_submissions")
        .select("id, receiving_party_name, receiving_party_entity, date_of_agreement, recipient_name, recipient_email, status, google_doc_url, notion_page_url, docusign_envelope_id, last_error, created_at")
        .order("created_at", { ascending: false })
        .limit(args.limit || 20);

      if (args.status) {
        query = query.eq("status", args.status);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list submissions: ${error.message}`);
      return {
        count: (data || []).length,
        submissions: data || [],
      };
    }

    case "send_nda_for_signature": {
      const res = await fetch(`${supabaseUrl}/functions/v1/nda-send-signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          submission_id: args.submission_id,
          dry_run: args.dry_run || false,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send for signature");
      return result;
    }

    default:
      throw new Error(`Unknown NDA tool: ${toolName}`);
  }
}

async function getBasecampAccessToken(supabaseAdmin: any): Promise<{ accessToken: string; accountId: string } | null> {
  const { data: tokenRow, error } = await supabaseAdmin
    .from("basecamp_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !tokenRow) return null;

  let accessToken = tokenRow.access_token;

  // Refresh if expired
  if (new Date(tokenRow.token_expiry) <= new Date()) {
    const clientId = Deno.env.get("BASECAMP_CLIENT_ID");
    const clientSecret = Deno.env.get("BASECAMP_CLIENT_SECRET");
    if (!clientId || !clientSecret) return null;

    const refreshRes = await fetch("https://launchpad.37signals.com/authorization/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "refresh",
        refresh_token: tokenRow.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!refreshRes.ok) return null;
    const refreshed = await refreshRes.json();
    accessToken = refreshed.access_token;

    await supabaseAdmin
      .from("basecamp_tokens")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokenRow.refresh_token,
        token_expiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", tokenRow.id);
  }

  return { accessToken, accountId: tokenRow.account_id || Deno.env.get("BASECAMP_ACCOUNT_ID") || "" };
}

async function executeBasecampTool(toolName: string, args: any, accessToken: string, accountId: string): Promise<any> {
  const baseUrl = `https://3.basecampapi.com/${accountId}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "Duncan (duncan.help)",
  };

  async function bcFetch(endpoint: string) {
    const url = `${baseUrl}/${endpoint}.json`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Basecamp API error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  switch (toolName) {
    case "list_basecamp_projects": {
      const projects = await bcFetch("projects");
      return (projects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        url: p.app_url,
        dock: (p.dock || []).filter((d: any) => d.enabled).map((d: any) => ({
          id: d.id,
          title: d.title,
          name: d.name,
        })),
      }));
    }
    case "get_basecamp_todolists": {
      const lists = await bcFetch(`buckets/${args.project_id}/todosets/${args.todoset_id}/todolists`);
      return (lists || []).map((l: any) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        completed: l.completed,
        completed_ratio: l.completed_ratio,
      }));
    }
    case "get_basecamp_todos": {
      const todos = await bcFetch(`buckets/${args.project_id}/todolists/${args.todolist_id}/todos`);
      return (todos || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        due_on: t.due_on,
        assignees: (t.assignees || []).map((a: any) => a.name),
        creator: t.creator?.name,
      }));
    }
    case "get_basecamp_messages": {
      const msgs = await bcFetch(`buckets/${args.project_id}/message_boards/${args.message_board_id}/messages`);
      return (msgs || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        content: (m.content || "").slice(0, 2000),
        created_at: m.created_at,
        creator: m.creator?.name,
      }));
    }
    case "get_basecamp_card_table_cards": {
      console.log(`Fetching card table: buckets/${args.project_id}/card_tables/${args.kanban_board_id}`);
      const cardTable = await bcFetch(`buckets/${args.project_id}/card_tables/${args.kanban_board_id}`);
      console.log(`Card table response keys: ${Object.keys(cardTable).join(", ")}`);
      console.log(`Card table title: ${cardTable.title}, lists count: ${cardTable.lists?.length ?? "no lists"}`);

      if (!cardTable.lists || !Array.isArray(cardTable.lists)) {
        console.log("No lists found, returning raw card table keys:", Object.keys(cardTable));
        return { card_table: cardTable.title || "Unknown", columns: [], raw_keys: Object.keys(cardTable) };
      }

      // If a specific column_id is provided, fetch only that column's cards
      if (args.column_id) {
        const list = cardTable.lists.find((l: any) => l.id === args.column_id);
        if (!list) return { error: `Column ${args.column_id} not found` };
        const cardsUrl = list.cards_url;
        console.log(`Fetching cards for column ${list.title} from: ${cardsUrl}`);
        const res = await fetch(cardsUrl, { headers });
        if (!res.ok) { const t = await res.text(); console.error("Cards fetch failed:", t); return { error: `Failed: ${res.status}` }; }
        const cards = await res.json();
        return {
          column: list.title, color: list.color, cards_count: cards.length,
          cards: cards.map((c: any) => ({
            id: c.id, title: c.title, due_on: c.due_on, completed: c.completed,
            assignees: (c.assignees || []).map((a: any) => a.name),
            creator: c.creator?.name,
            description: (c.content || c.description || "").slice(0, 300),
          })),
        };
      }

      // Fetch ALL columns' cards in parallel (with a 3-card preview per column to stay within timeout)
      const columnsWithCards = await Promise.all(
        cardTable.lists.map(async (list: any) => {
          try {
            const cardsUrl = list.cards_url;
            if (!cardsUrl) return { id: list.id, title: list.title, color: list.color, cards_count: list.cards_count || 0, cards: [], error: "no cards_url" };
            const res = await fetch(cardsUrl, { headers });
            if (!res.ok) { await res.text(); return { id: list.id, title: list.title, color: list.color, cards_count: list.cards_count || 0, cards: [], error: `fetch failed ${res.status}` }; }
            const cards = await res.json();
            return {
              id: list.id, title: list.title, color: list.color, cards_count: cards.length,
              cards: cards.map((c: any) => ({
                id: c.id, title: c.title, due_on: c.due_on, completed: c.completed,
                assignees: (c.assignees || []).map((a: any) => a.name),
                creator: c.creator?.name,
              })),
            };
          } catch (e) {
            return { id: list.id, title: list.title, color: list.color, cards_count: list.cards_count || 0, cards: [], error: String(e) };
          }
        })
      );

      console.log(`Fetched cards for ${columnsWithCards.length} columns`);
      return { card_table: cardTable.title, columns: columnsWithCards };
    }
    default:
      throw new Error(`Unknown Basecamp tool: ${toolName}`);
  }
}

async function getNotionToken(supabaseAdmin: any): Promise<string | null> {
  const { data: integration } = await supabaseAdmin
    .from("company_integrations")
    .select("encrypted_api_key, status")
    .eq("integration_id", "notion")
    .single();

  if (!integration || integration.status !== "connected" || !integration.encrypted_api_key) {
    return null;
  }
  return atob(integration.encrypted_api_key);
}

function extractNotionText(richText: any[]): string {
  return (richText || []).map((t: any) => t.plain_text || "").join("");
}

function summarizeNotionProperties(properties: any): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const [key, val] of Object.entries(properties || {})) {
    const v = val as any;
    switch (v.type) {
      case "title": summary[key] = extractNotionText(v.title); break;
      case "rich_text": summary[key] = extractNotionText(v.rich_text); break;
      case "number": summary[key] = v.number != null ? String(v.number) : ""; break;
      case "select": summary[key] = v.select?.name || ""; break;
      case "multi_select": summary[key] = (v.multi_select || []).map((s: any) => s.name).join(", "); break;
      case "date": summary[key] = v.date?.start || ""; break;
      case "checkbox": summary[key] = v.checkbox ? "Yes" : "No"; break;
      case "url": summary[key] = v.url || ""; break;
      case "email": summary[key] = v.email || ""; break;
      case "phone_number": summary[key] = v.phone_number || ""; break;
      case "status": summary[key] = v.status?.name || ""; break;
      default: break;
    }
  }
  return summary;
}

function summarizeNotionBlock(block: any): string {
  const type = block.type;
  const data = block[type];
  if (!data) return "";
  if (data.rich_text) return extractNotionText(data.rich_text);
  if (type === "image") return `[Image: ${data.external?.url || data.file?.url || ""}]`;
  if (type === "divider") return "---";
  return "";
}

async function executeNotionTool(toolName: string, args: any, token: string): Promise<any> {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  switch (toolName) {
    case "search_notion": {
      const res = await fetch(`${NOTION_API_URL}/search`, {
        method: "POST", headers,
        body: JSON.stringify({ query: args.query || "", page_size: args.page_size || 10 }),
      });
      if (!res.ok) throw new Error(`Notion search failed: ${await res.text()}`);
      const data = await res.json();
      return (data.results || []).map((r: any) => ({
        id: r.id,
        type: r.object,
        title: r.object === "page"
          ? extractNotionText(Object.values(r.properties || {}).find((p: any) => p.type === "title")?.title || [])
          : r.title?.[0]?.plain_text || "Untitled",
        url: r.url,
        ...(r.object === "page" ? { properties: summarizeNotionProperties(r.properties) } : {}),
      }));
    }

    case "query_notion_database": {
      const res = await fetch(`${NOTION_API_URL}/databases/${args.database_id}/query`, {
        method: "POST", headers,
        body: JSON.stringify({ page_size: args.page_size || 20 }),
      });
      if (!res.ok) throw new Error(`Notion query failed: ${await res.text()}`);
      const data = await res.json();
      return {
        total: data.results?.length || 0,
        has_more: data.has_more,
        entries: (data.results || []).map((r: any) => ({
          id: r.id,
          url: r.url,
          properties: summarizeNotionProperties(r.properties),
        })),
      };
    }

    case "get_notion_page_content": {
      const res = await fetch(`${NOTION_API_URL}/blocks/${args.page_id}/children?page_size=100`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}`, "Notion-Version": NOTION_VERSION },
      });
      if (!res.ok) throw new Error(`Notion page read failed: ${await res.text()}`);
      const data = await res.json();
      const blocks = (data.results || []).map((b: any) => ({
        type: b.type,
        content: summarizeNotionBlock(b),
      })).filter((b: any) => b.content);
      return { block_count: blocks.length, content: blocks };
    }

    default:
      throw new Error(`Unknown Notion tool: ${toolName}`);
  }
}

function getAzureStorageConfig(): { accountName: string; accountKey: string; containerName: string } | null {
  const connStr = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
  if (!connStr) return null;
  
  const parts: Record<string, string> = {};
  for (const part of connStr.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) parts[part.slice(0, idx)] = part.slice(idx + 1);
  }
  if (!parts.AccountName || !parts.AccountKey) return null;
  return { accountName: parts.AccountName, accountKey: parts.AccountKey, containerName: "duncanstorage01" };
}

async function executeDocumentTool(
  toolName: string,
  args: any,
  supabaseUrl: string,
  authHeader: string
): Promise<any> {
  switch (toolName) {
    case "search_documents": {
      const res = await fetch(`${supabaseUrl}/functions/v1/azure-blob-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ action: "search", query: args.query }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Document search failed");
      }
      const data = await res.json();
      return {
        found: data.found || 0,
        files: (data.files || []).map((f: any) => ({
          name: f.name,
          blob_path: f.name,
          size: f.size,
          lastModified: f.lastModified,
          url: f.url,
        })),
        message: (data.files || []).length === 0 
          ? "No documents found matching your query." 
          : `Found ${(data.files || []).length} document(s).`,
      };
    }

    case "read_document": {
      const blobPath = args.blob_path;
      if (!blobPath) throw new Error("blob_path is required");

      const res = await fetch(`${supabaseUrl}/functions/v1/azure-blob-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ action: "get_content", blob_path: blobPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to read document");
      }
      const data = await res.json();
      return {
        name: data.name,
        blob_path: data.blob_path,
        url: data.url,
        content: (data.content || "").slice(0, 40000),
      };
    }

    case "list_documents": {
      const res = await fetch(`${supabaseUrl}/functions/v1/azure-blob-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ action: "list", path: args.path || "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to list documents");
      }
      const data = await res.json();
      return {
        files: (data.files || []).map((f: any) => ({
          name: f.name,
          blob_path: f.name,
          size: f.size,
          lastModified: f.lastModified,
        })),
        folders: data.folders || [],
      };
    }

    default:
      throw new Error(`Unknown document tool: ${toolName}`);
  }
}

async function getCalendarAccessToken(userId: string, supabaseAdmin: any): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.log("Google Calendar credentials not configured");
    return null;
  }

  const { data: tokenData, error } = await supabaseAdmin
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    console.log("No calendar tokens found for user");
    return null;
  }

  // Check if token needs refresh
  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry <= new Date()) {
    console.log("Token expired, refreshing...");
    
    const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!refreshResponse.ok) {
      console.error("Failed to refresh token");
      return null;
    }

    const newTokens = await refreshResponse.json();
    const newExpiry = new Date(Date.now() + (newTokens.expires_in * 1000));
    
    await supabaseAdmin
      .from("google_calendar_tokens")
      .update({
        access_token: newTokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq("user_id", userId);

    return newTokens.access_token;
  }

  return tokenData.access_token;
}

async function executeCalendarTool(
  toolName: string,
  args: any,
  accessToken: string
): Promise<any> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  switch (toolName) {
    case "list_calendar_events": {
      const timeMin = args.timeMin || new Date().toISOString();
      const timeMax = args.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const maxResults = args.maxResults || 10;

      const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events`);
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("maxResults", String(maxResults));
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");

      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list events: ${error}`);
      }
      const data = await response.json();
      return data.items || [];
    }

    case "create_calendar_event": {
      const event = {
        summary: args.summary,
        description: args.description,
        start: { dateTime: args.startDateTime, timeZone: "UTC" },
        end: { dateTime: args.endDateTime, timeZone: "UTC" },
        location: args.location,
        attendees: args.attendees?.map((email: string) => ({ email })),
      };

      const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
        method: "POST",
        headers,
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create event: ${error}`);
      }
      return await response.json();
    }

    case "update_calendar_event": {
      const { eventId, ...updates } = args;
      const event: any = {};
      if (updates.summary) event.summary = updates.summary;
      if (updates.description) event.description = updates.description;
      if (updates.startDateTime) event.start = { dateTime: updates.startDateTime, timeZone: "UTC" };
      if (updates.endDateTime) event.end = { dateTime: updates.endDateTime, timeZone: "UTC" };
      if (updates.location) event.location = updates.location;

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update event: ${error}`);
      }
      return await response.json();
    }

    case "delete_calendar_event": {
      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${args.eventId}`,
        { method: "DELETE", headers }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete event: ${error}`);
      }
      return { success: true, message: "Event deleted successfully" };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, userProfile } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string = "";
    let calendarAccessToken: string | null = null;
    let azureStorageAvailable = false;
    let notionToken: string | null = null;
    let basecampCreds: { accessToken: string; accountId: string } | null = null;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (authHeader) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email || "";
        calendarAccessToken = await getCalendarAccessToken(userId, supabaseAdmin);
      }
    }

    // Check Azure Blob Storage availability
    azureStorageAvailable = !!getAzureStorageConfig();

    // Get Notion token (company-wide)
    notionToken = await getNotionToken(supabaseAdmin);

    // Get Basecamp credentials (company-wide)
    basecampCreds = await getBasecampAccessToken(supabaseAdmin);
    // Get available Google Forms and inject into system prompt
    const { data: googleForms } = await supabaseAdmin
      .from("google_forms")
      .select("id, name, description, fields");

    // Adjust system prompt based on mode and integration availability
    let systemContent = SYSTEM_PROMPT;

    // Always inject available forms into the system prompt so the model has field data across all turns
    if (googleForms && googleForms.length > 0) {
      let formsContext = "\n\n## AVAILABLE GOOGLE FORMS (PRE-LOADED — DO NOT CALL list_google_forms)\nThe following forms are available. Use ONLY these exact fields when asking questions:\n";
      for (const form of googleForms) {
        formsContext += `\n### Form: "${form.name}" (ID: ${form.id})\n`;
        if (form.description) formsContext += `Description: ${form.description}\n`;
        formsContext += `Fields (ask ONLY these, in this order):\n`;
        const fields = form.fields as any[];
        for (let i = 0; i < fields.length; i++) {
          const f = fields[i];
          formsContext += `  ${i + 1}. Label: "${f.label}" | entry_id: ${f.entry_id} | type: ${f.type} | required: ${f.required}${f.options ? ` | options: ${f.options.join(", ")}` : ""}\n`;
        }
        formsContext += `Total fields: ${fields.length}. Ask exactly ${fields.length} questions — no more, no less.\n`;
      }
      systemContent += formsContext;
    }

    if (!calendarAccessToken) {
      systemContent += "\n\nNote: Google Calendar is not connected for you. If the user asks about calendar operations, let them know they need to connect their Google Calendar first via the Integrations page.";
    }

    if (!azureStorageAvailable) {
      systemContent += "\n\nNote: Document storage is not configured. If the user asks about documents or company files, let them know the document storage system needs to be configured first.";
    }

    if (!notionToken) {
      systemContent += "\n\nNote: Notion is not connected. If the user asks about Notion data, let them know an admin needs to connect Notion first via the Integrations page.";
    }

    if (!basecampCreds) {
      systemContent += "\n\nNote: Basecamp is not connected. If the user asks about Basecamp projects, to-dos, or messages, let them know an admin needs to connect Basecamp first via the Integrations page.";
    }

    // Inject user profile context if available
    if (userProfile) {
      const parts: string[] = [];
      if (userProfile.display_name) parts.push(`Name: ${userProfile.display_name}`);
      if (userProfile.role_title) parts.push(`Role: ${userProfile.role_title}`);
      if (userProfile.department) parts.push(`Department: ${userProfile.department}`);
      if (userProfile.bio) parts.push(`About: ${userProfile.bio}`);
      if (userProfile.norman_context) parts.push(`Additional context: ${userProfile.norman_context}`);
      if (parts.length > 0) {
        systemContent += `\n\nYou are speaking with a team member. Here is their profile:\n${parts.join("\n")}\n\nUse this information to personalise your responses. Address them by name when appropriate.`;
      }
    }

    if (mode === "reason") {
      systemContent += "\n\nYou are in REASONING mode. Think deeply and step-by-step. Show your reasoning chain explicitly using numbered steps. Consider multiple angles before concluding.";
    } else if (mode === "automate") {
      systemContent += "\n\nYou are in AUTOMATION mode. Focus on creating actionable automation plans. For each step, specify: the trigger, the action, the target system, and expected outcome. Format as a clear workflow.";
    } else if (mode === "analyze") {
      systemContent += "\n\nYou are in ANALYSIS mode. Focus on data patterns, trends, and insights. Use structured formats like tables and comparisons. Quantify findings when possible.";
    }

    // First call to AI with tools if calendar is connected
    const requestBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemContent },
        ...messages,
      ],
      stream: true,
    };

    // Include tools based on what's connected
    const tools: any[] = [...GOOGLE_FORMS_TOOLS, ...NDA_TOOLS]; // Always available
    if (calendarAccessToken) {
      tools.push(...CALENDAR_TOOLS);
    }
    if (azureStorageAvailable) {
      tools.push(...DOCUMENT_TOOLS);
    }
    if (notionToken) {
      tools.push(...NOTION_TOOLS);
    }
    if (basecampCreds) {
      tools.push(...BASECAMP_TOOLS);
    }
    // Meeting tools always available (Gmail connection checked at execution time)
    tools.push(...MEETING_TOOLS);
    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    // Helper to call OpenAI with retry on 429 + fallback model
    const MAX_RETRIES = 4;
    const FALLBACK_MODEL = "gpt-4.1-mini";

    async function fetchAIWithRetry(body: any): Promise<Response> {
      const modelsToTry = body?.model === FALLBACK_MODEL
        ? [body.model]
        : [body.model, FALLBACK_MODEL];

      for (const model of modelsToTry) {
        const requestBody = { ...body, model };

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const resp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (resp.status === 429 && attempt < MAX_RETRIES - 1) {
            const retryAfter = parseInt(resp.headers.get("retry-after") || "0", 10);
            const baseDelay = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000;
            const jitter = Math.floor(Math.random() * 400);
            const delay = baseDelay + jitter;
            console.log(`AI 429 on ${model}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          if (resp.status !== 429) return resp;
          break;
        }
      }

      // Final attempt response (429) for caller handling
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    }

    const response = await fetchAIWithRetry(requestBody);

    if (!response.ok) {
      if (response.status === 429) {
        console.error("AI rate limit exceeded after retries");
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper to parse an SSE stream and extract content + tool calls
    async function parseSSEStream(streamResponse: Response): Promise<{ fullContent: string; toolCalls: any[] }> {
      const reader = streamResponse.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let toolCalls: any[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            
            if (delta?.content) {
              fullContent += delta.content;
            }
            
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index;
                if (!toolCalls[index]) {
                  toolCalls[index] = { id: tc.id, type: "function", function: { name: "", arguments: "" } };
                }
                if (tc.function?.name) {
                  toolCalls[index].function.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  toolCalls[index].function.arguments += tc.function.arguments;
                }
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      return { fullContent, toolCalls };
    }

    // Helper to execute tool calls and return results
    async function executeToolCalls(toolCalls: any[]): Promise<any[]> {
      const calendarToolNames = ["list_calendar_events", "create_calendar_event", "update_calendar_event", "delete_calendar_event"];
      const documentToolNames = ["search_documents", "read_document", "list_documents"];
      const notionToolNames = ["search_notion", "query_notion_database", "get_notion_page_content"];
      const googleFormsToolNames = ["list_google_forms", "submit_google_form", "parse_google_form", "save_parsed_google_form"];
      const ndaToolNames = ["generate_nda", "list_nda_submissions", "send_nda_for_signature"];
      const basecampToolNames = ["list_basecamp_projects", "get_basecamp_todolists", "get_basecamp_todos", "get_basecamp_messages", "get_basecamp_card_table_cards"];
      const meetingToolNames = ["fetch_plaud_meetings", "list_meetings", "get_meeting", "analyze_meetings", "search_meeting_transcripts"];
      const toolResults: any[] = [];

      for (const tc of toolCalls) {
        try {
          const args = JSON.parse(tc.function.arguments);
          let result: any;
          
          if (calendarToolNames.includes(tc.function.name)) {
            if (!calendarAccessToken) {
              result = { error: "Google Calendar is not connected. Please connect it via the Integrations page." };
            } else {
              result = await executeCalendarTool(tc.function.name, args, calendarAccessToken);
            }
          } else if (documentToolNames.includes(tc.function.name)) {
            if (!azureStorageAvailable) {
              result = { error: "Document storage is not configured. Please contact an admin." };
            } else {
              result = await executeDocumentTool(tc.function.name, args, supabaseUrl, authHeader || "");
            }
          } else if (notionToolNames.includes(tc.function.name)) {
            if (!notionToken) {
              result = { error: "Notion is not connected. An admin needs to connect it via the Integrations page." };
            } else {
              result = await executeNotionTool(tc.function.name, args, notionToken);
            }
          } else if (googleFormsToolNames.includes(tc.function.name)) {
            result = await executeGoogleFormsTool(tc.function.name, args, supabaseAdmin);
          } else if (ndaToolNames.includes(tc.function.name)) {
            result = await executeNdaTool(tc.function.name, args, supabaseAdmin, userId || "", userEmail, authHeader || "");
          } else if (basecampToolNames.includes(tc.function.name)) {
            if (!basecampCreds) {
              result = { error: "Basecamp is not connected. An admin needs to connect it via the Integrations page." };
            } else {
              result = await executeBasecampTool(tc.function.name, args, basecampCreds.accessToken, basecampCreds.accountId);
              console.log(`Basecamp tool ${tc.function.name} result preview:`, JSON.stringify(result).slice(0, 500));
            }
          } else if (meetingToolNames.includes(tc.function.name)) {
              result = await executeMeetingTool(tc.function.name, args, supabaseAdmin, supabaseUrl, authHeader || "");
          } else {
          }
          
          toolResults.push({
            tool_call_id: tc.id,
            role: "tool",
            content: JSON.stringify(result),
          });
        } catch (error) {
          console.error(`Tool ${tc.function.name} threw error:`, error.message, error.stack);
          toolResults.push({
            tool_call_id: tc.id,
            role: "tool",
            content: JSON.stringify({ error: error.message }),
          });
        }
      }

      return toolResults;
    }

    // Parse the initial response
    let { fullContent, toolCalls } = await parseSSEStream(response);
    console.log("Stream parsed - content length:", fullContent.length, "tool calls:", toolCalls.length, toolCalls.map(tc => tc?.function?.name));

    // Conversation history for multi-round tool calls
    const conversationMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    // Loop: execute tool calls up to 5 rounds
    const MAX_TOOL_ROUNDS = 5;
    let round = 0;

    while (toolCalls.length > 0 && round < MAX_TOOL_ROUNDS) {
      round++;
      console.log(`Tool call round ${round}:`, toolCalls.map(tc => tc.function.name));

      // Execute tool calls
      const toolResults = await executeToolCalls(toolCalls);

      // Build assistant message for this round
      const assistantMsg: any = { role: "assistant", tool_calls: toolCalls };
      if (fullContent) {
        assistantMsg.content = fullContent;
      }

      // Add to conversation
      conversationMessages.push(assistantMsg, ...toolResults);

      // Check if this is the last allowed round - if so, stream the response
      const isLastRound = round >= MAX_TOOL_ROUNDS;

      // Make follow-up request with retry
      const followUpResponse = await fetchAIWithRetry({
        model: "google/gemini-3-flash-preview",
        messages: conversationMessages,
        stream: true,
        ...(isLastRound ? {} : { tools }),
      });

      if (!followUpResponse.ok) {
        const text = await followUpResponse.text();
        console.error(`Follow-up AI error (round ${round}):`, text);
        return new Response(
          JSON.stringify({ error: "Failed to process tool results" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse the follow-up to check for more tool calls
      const followUp = await parseSSEStream(followUpResponse);
      fullContent = followUp.fullContent;
      toolCalls = followUp.toolCalls;

      console.log(`Round ${round} result - content length: ${fullContent.length}, tool calls: ${toolCalls.length}`);

      // If no more tool calls, we have the final content - break
      if (toolCalls.length === 0) {
        break;
      }
    }

    // Stream the final content as SSE to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        if (fullContent) {
          const chunk = {
            choices: [{ delta: { content: fullContent } }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("norman-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
