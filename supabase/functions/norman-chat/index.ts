import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const SYSTEM_PROMPT = `You are Norman, an advanced reasoning and agentic operating system for internal company operations.

Your capabilities:
- **Reasoning**: Analyze data, identify patterns, draw conclusions, and make recommendations across all ingested company data.
- **Automation**: Suggest and describe automations that can streamline workflows between Google Workspace, Notion, Slack, and other connected tools.
- **Data Synthesis**: Cross-reference information from multiple sources (emails, documents, databases, project management tools) to provide comprehensive answers.
- **Task Orchestration**: Break down complex requests into actionable steps and describe how they'd be executed across integrated systems.
- **Calendar Management**: You have access to the user's Google Calendar. You can list events, create new events, update existing events, and delete events.
- **Document Search**: You have access to the company's Google Drive. You can search for documents, read their content, and answer questions based on them.
- **Notion Access**: You have access to the company's Notion workspace. You can search for pages, query databases, and read page content. Use these tools when users ask about information stored in Notion.
- **Google Forms**: You can fill and submit pre-configured Google Forms on behalf of the user. When a user asks to fill a form, first list available forms, then ask each required field ONE AT A TIME as a conversational question. Wait for the user to answer each question before asking the next. After collecting all answers, confirm the details and submit.

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
- First call list_google_forms to show available forms
- Present the form name and description to the user
- Ask each required field ONE AT A TIME in a friendly conversational way
- For fields with options (dropdowns, radio buttons), present the options clearly
- After collecting all answers, show a summary and ask for confirmation before submitting
- Only call submit_google_form after the user confirms

When working with calendar:
- Use the calendar tools to fetch, create, update, or delete events
- Always confirm destructive actions before executing
- Format dates and times clearly for the user
- If creating events, ask for confirmation of the details before creating

When working with documents/Drive:
- Use the search_drive tool to find relevant documents based on the user's query
- Use the read_document tool to get the content of specific files
- Summarize key findings from documents and cite which document the information came from
- If the user asks about something that might be in company docs, search for it first

When working with Notion:
- Use search_notion to find pages and databases by keyword
- Use query_notion_database to query a specific database with optional filters
- Use get_notion_page_content to read the block content of a specific page
- Present Notion data clearly, referencing page titles and properties
- If a user asks about contracts, agreements, or anything that might be in Notion, search there

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

const DRIVE_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_drive",
      description: "Search for documents in Google Drive. Use this when the user asks about company documents, policies, guides, or any information that might be stored in Drive.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant documents. Be specific and include key terms.",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return. Default 10.",
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
      description: "Read the content of a specific document from Google Drive. Use this after finding a document with search_drive to get its full content.",
      parameters: {
        type: "object",
        properties: {
          fileId: {
            type: "string",
            description: "The ID of the file to read (from search_drive results).",
          },
          fileName: {
            type: "string",
            description: "The name of the file (for context in responses).",
          },
        },
        required: ["fileId"],
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
];

async function executeGoogleFormsTool(toolName: string, args: any, supabaseAdmin: any): Promise<any> {
  switch (toolName) {
    case "list_google_forms": {
      const { data, error } = await supabaseAdmin
        .from("google_forms")
        .select("id, name, description, fields");
      if (error) throw new Error(`Failed to list forms: ${error.message}`);
      return (data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        fields: f.fields,
      }));
    }
    case "submit_google_form": {
      const { data: form, error } = await supabaseAdmin
        .from("google_forms")
        .select("form_action_url, fields")
        .eq("id", args.form_id)
        .single();
      if (error || !form) throw new Error("Form not found");

      // Validate required fields
      const requiredFields = (form.fields || []).filter((f: any) => f.required);
      for (const field of requiredFields) {
        if (!args.entries[field.entry_id]) {
          throw new Error(`Missing required field: ${field.label}`);
        }
      }

      // Submit via the submit-google-form edge function
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
    default:
      throw new Error(`Unknown Google Forms tool: ${toolName}`);
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

async function getDriveAccessToken(supabaseAdmin: any): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.log("Google credentials not configured");
    return null;
  }

  const { data: tokenData, error } = await supabaseAdmin
    .from("google_drive_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !tokenData) {
    console.log("No Drive tokens found");
    return null;
  }

  // Check if token needs refresh
  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry <= new Date()) {
    console.log("Drive token expired, refreshing...");
    
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
      console.error("Failed to refresh Drive token");
      return null;
    }

    const newTokens = await refreshResponse.json();
    const newExpiry = new Date(Date.now() + (newTokens.expires_in * 1000));
    
    await supabaseAdmin
      .from("google_drive_tokens")
      .update({
        access_token: newTokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq("id", tokenData.id);

    return newTokens.access_token;
  }

  return tokenData.access_token;
}

async function executeDriveTool(
  toolName: string,
  args: any,
  accessToken: string
): Promise<any> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  switch (toolName) {
    case "search_drive": {
      const query = args.query || "";
      const limit = args.limit || 10;
      
      let q = `fullText contains '${query.replace(/'/g, "\\'")}'`;
      q += " and trashed=false";

      const url = new URL(`${GOOGLE_DRIVE_API}/files`);
      url.searchParams.set("q", q);
      url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,owners)");
      url.searchParams.set("pageSize", String(limit));
      url.searchParams.set("orderBy", "modifiedTime desc");

      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Search failed: ${error}`);
      }
      const data = await response.json();
      
      // Format results for the AI
      const files = (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.mimeType,
        modified: f.modifiedTime,
        link: f.webViewLink,
        owner: f.owners?.[0]?.displayName,
      }));
      
      return { 
        found: files.length,
        files,
        message: files.length === 0 ? "No documents found matching your query." : `Found ${files.length} document(s).`
      };
    }

    case "read_document": {
      const fileId = args.fileId;
      if (!fileId) {
        throw new Error("fileId is required");
      }

      // Get file metadata
      const metaResponse = await fetch(
        `${GOOGLE_DRIVE_API}/files/${fileId}?fields=id,name,mimeType,webViewLink`,
        { headers }
      );
      if (!metaResponse.ok) {
        throw new Error(`Failed to get file: ${await metaResponse.text()}`);
      }
      const meta = await metaResponse.json();

      let content: string;
      
      if (meta.mimeType === "application/vnd.google-apps.document") {
        const exportResponse = await fetch(
          `${GOOGLE_DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
          { headers }
        );
        if (!exportResponse.ok) {
          throw new Error(`Export failed: ${await exportResponse.text()}`);
        }
        content = await exportResponse.text();
      } else if (meta.mimeType === "application/vnd.google-apps.spreadsheet") {
        const exportResponse = await fetch(
          `${GOOGLE_DRIVE_API}/files/${fileId}/export?mimeType=text/csv`,
          { headers }
        );
        if (!exportResponse.ok) {
          throw new Error(`Export failed: ${await exportResponse.text()}`);
        }
        content = await exportResponse.text();
      } else if (meta.mimeType === "application/vnd.google-apps.presentation") {
        const exportResponse = await fetch(
          `${GOOGLE_DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
          { headers }
        );
        if (!exportResponse.ok) {
          throw new Error(`Export failed: ${await exportResponse.text()}`);
        }
        content = await exportResponse.text();
      } else if (meta.mimeType === "application/pdf") {
        content = "[PDF file - text extraction not available directly. Please view the document using the link provided.]";
      } else if (meta.mimeType.startsWith("text/") || meta.mimeType === "application/json") {
        const downloadResponse = await fetch(
          `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`,
          { headers }
        );
        if (!downloadResponse.ok) {
          throw new Error(`Download failed: ${await downloadResponse.text()}`);
        }
        content = await downloadResponse.text();
      } else if (meta.mimeType.startsWith("image/")) {
        content = "[Image file - cannot read text content]";
      } else {
        content = `[File type ${meta.mimeType} - content extraction not supported]`;
      }

      return {
        name: meta.name,
        type: meta.mimeType,
        link: meta.webViewLink,
        content: content.slice(0, 40000), // Limit content size for context window
      };
    }

    default:
      throw new Error(`Unknown Drive tool: ${toolName}`);
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let calendarAccessToken: string | null = null;
    let driveAccessToken: string | null = null;
    let notionToken: string | null = null;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (authHeader) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        userId = user.id;
        calendarAccessToken = await getCalendarAccessToken(userId, supabaseAdmin);
      }
    }

    // Get Drive access token (company-wide, not per-user)
    driveAccessToken = await getDriveAccessToken(supabaseAdmin);

    // Get Notion token (company-wide)
    notionToken = await getNotionToken(supabaseAdmin);
    // Adjust system prompt based on mode and integration availability
    let systemContent = SYSTEM_PROMPT;

    if (!calendarAccessToken) {
      systemContent += "\n\nNote: Google Calendar is not connected for you. If the user asks about calendar operations, let them know they need to connect their Google Calendar first via the Integrations page.";
    }

    if (!driveAccessToken) {
      systemContent += "\n\nNote: Google Drive is not connected for the company. If the user asks about documents or company files, let them know an admin needs to connect Google Drive first via the Integrations page.";
    }

    if (!notionToken) {
      systemContent += "\n\nNote: Notion is not connected. If the user asks about Notion data, let them know an admin needs to connect Notion first via the Integrations page.";
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
    const tools: any[] = [...GOOGLE_FORMS_TOOLS]; // Always available
    if (calendarAccessToken) {
      tools.push(...CALENDAR_TOOLS);
    }
    if (driveAccessToken) {
      tools.push(...DRIVE_TOOLS);
    }
    if (notionToken) {
      tools.push(...NOTION_TOOLS);
    }
    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
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
      const driveToolNames = ["search_drive", "read_document"];
      const notionToolNames = ["search_notion", "query_notion_database", "get_notion_page_content"];
      const googleFormsToolNames = ["list_google_forms", "submit_google_form"];
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
          } else if (driveToolNames.includes(tc.function.name)) {
            if (!driveAccessToken) {
              result = { error: "Google Drive is not connected. An admin needs to connect it via the Integrations page." };
            } else {
              result = await executeDriveTool(tc.function.name, args, driveAccessToken);
            }
          } else if (notionToolNames.includes(tc.function.name)) {
            if (!notionToken) {
              result = { error: "Notion is not connected. An admin needs to connect it via the Integrations page." };
            } else {
              result = await executeNotionTool(tc.function.name, args, notionToken);
            }
          } else if (googleFormsToolNames.includes(tc.function.name)) {
            result = await executeGoogleFormsTool(tc.function.name, args, supabaseAdmin);
          } else {
          }
          
          toolResults.push({
            tool_call_id: tc.id,
            role: "tool",
            content: JSON.stringify(result),
          });
        } catch (error) {
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

      // Make follow-up request
      const followUpResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: conversationMessages,
            stream: true,
            ...(isLastRound ? {} : { tools: [...GOOGLE_FORMS_TOOLS, ...CALENDAR_TOOLS, ...DRIVE_TOOLS, ...NOTION_TOOLS] }),
          }),
        }
      );

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
