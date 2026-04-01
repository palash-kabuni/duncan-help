import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT = `You are Duncan, an advanced reasoning and operating system for internal company operations.
You are currently operating inside a Project workspace. Focus your responses on the context and instructions provided for this project.
Be direct, precise, and efficient. Use structured output when presenting complex information.`;

/** Generate embedding for a single text. */
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("Embedding error:", resp.status, err);
    throw new Error("Failed to generate query embedding");
  }
  const data = await resp.json();
  return data.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse input (selected_file_ids no longer used)
    const { chat_id, message } = await req.json();
    if (!chat_id || typeof chat_id !== "string") {
      return new Response(JSON.stringify({ error: "chat_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch chat (RLS enforces ownership)
    const { data: chat, error: chatError } = await supabase
      .from("project_chats")
      .select("id, project_id, title")
      .eq("id", chat_id)
      .single();

    if (chatError || !chat) {
      return new Response(JSON.stringify({ error: "Chat not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch project (RLS enforces ownership)
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, system_prompt")
      .eq("id", chat.project_id)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. RAG: Retrieve relevant chunks via vector similarity
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fileContextBlock = "";
    try {
      // Get file IDs for this project
      const { data: projectFiles } = await supabase
        .from("project_files")
        .select("id")
        .eq("project_id", chat.project_id);

      if (projectFiles && projectFiles.length > 0) {
        const fileIds = projectFiles.map((f: any) => f.id);

        // Generate embedding for user query
        const queryEmbedding = await getEmbedding(message.trim(), OPENAI_API_KEY);

        // Use service client for vector similarity query (RPC)
        const serviceClient = createClient(
          supabaseUrl,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Query top 5 most relevant chunks using raw SQL via RPC
        const embeddingStr = `[${queryEmbedding.join(",")}]`;
        const { data: chunks, error: chunksError } = await serviceClient
          .rpc("match_project_chunks", {
            query_embedding: embeddingStr,
            file_ids: fileIds,
            match_count: 5,
          });

        if (chunksError) {
          console.error("RAG query error:", chunksError);
          // Non-fatal: continue without context
        } else if (chunks && chunks.length > 0) {
          const contextTexts = chunks.map(
            (c: any, i: number) => `[Context ${i + 1}]\n${c.content}`
          );
          fileContextBlock =
            "\n\n## RELEVANT CONTEXT\nThe following excerpts were automatically retrieved from project files based on relevance to the user's question. Use them to inform your response.\n\n" +
            contextTexts.join("\n\n---\n\n");
        }
      }
    } catch (ragErr) {
      console.error("RAG retrieval failed (non-fatal):", ragErr);
      // Continue without context — don't block the chat
    }

    // 6. Fetch last 20 messages for context
    const { data: history, error: historyError } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("chat_id", chat_id)
      .order("created_at", { ascending: true })
      .limit(20);

    if (historyError) {
      console.error("Failed to fetch chat history:", historyError);
    }

    // 7. Save user message
    const { error: insertUserError } = await supabase
      .from("chat_messages")
      .insert({ chat_id, role: "user", content: message.trim() });

    if (insertUserError) {
      console.error("Failed to save user message:", insertUserError);
      return new Response(JSON.stringify({ error: "Failed to save message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Construct AI messages
    const baseSystemPrompt = project.system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT;
    const systemPrompt = baseSystemPrompt + fileContextBlock;

    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (history && history.length > 0) {
      for (const msg of history) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    aiMessages.push({ role: "user", content: message.trim() });

    // 9. Call OpenAI
    const PRIMARY_MODEL = "gpt-4.1";
    const FALLBACK_MODEL = "gpt-4.1-mini";
    const MAX_RETRIES = 4;

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
            await new Promise((r) => setTimeout(r, baseDelay + jitter));
            continue;
          }

          if (resp.status !== 429) return resp;
          break;
        }
      }

      return await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    }

    const aiResponse = await fetchAIWithRetry({
      model: PRIMARY_MODEL,
      messages: aiMessages,
      temperature: 0.7,
      max_tokens: 4096,
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

    // 10. Save assistant message
    const { error: insertAssistantError } = await supabase
      .from("chat_messages")
      .insert({ chat_id, role: "assistant", content: reply });

    if (insertAssistantError) {
      console.error("Failed to save assistant message:", insertAssistantError);
    }

    // 11. Return response
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("chat-with-project-context error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
