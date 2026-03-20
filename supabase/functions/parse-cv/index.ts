import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    result += String.fromCharCode(...chunk);
  }
  return btoa(result);
}

function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  // Handle double extensions like abc.docx.pdf — use the last real extension
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidate_id, storage_path } = await req.json();

    if (!candidate_id || !storage_path) {
      return new Response(
        JSON.stringify({ error: "candidate_id and storage_path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Download CV from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("cvs")
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download CV file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = uint8ToBase64(bytes);
    const ext = storage_path.split(".").pop()?.toLowerCase() || "";
    const mimeType = getMimeType(ext);
    const filename = storage_path.split("/").pop() || `cv.${ext}`;

    // Send the file directly to GPT-4.1 using the file content type
    // This works for PDF, DOCX, DOC and other document formats
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are a CV/resume parser. Extract the candidate's full name and email address from the document. 
If you cannot find an email, return null for email. 
Always return the result by calling the extract_candidate_info function.`,
          },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename,
                  file_data: `data:${mimeType};base64,${base64}`,
                },
              },
              {
                type: "text",
                text: "Extract the candidate's full name and email address from this CV/resume document.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_candidate_info",
              description: "Extract candidate name and email from a CV document",
              parameters: {
                type: "object",
                properties: {
                  full_name: {
                    type: "string",
                    description: "The candidate's full name as shown on their CV",
                  },
                  email: {
                    type: ["string", "null"],
                    description: "The candidate's email address, or null if not found",
                  },
                },
                required: ["full_name", "email"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_candidate_info" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI parsing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData));

    let parsedName: string | null = null;
    let parsedEmail: string | null = null;

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        parsedName = args.full_name || null;
        parsedEmail = args.email || null;
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
      }
    }

    if (!parsedName) {
      return new Response(
        JSON.stringify({ error: "Could not extract candidate name from CV", candidate_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updateData: Record<string, string> = { name: parsedName };
    if (parsedEmail) updateData.email = parsedEmail;

    const { error: updateError } = await supabaseAdmin
      .from("candidates")
      .update(updateData)
      .eq("id", candidate_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update candidate record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        candidate_id,
        parsed_name: parsedName,
        parsed_email: parsedEmail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Parse CV error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to parse CV" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
