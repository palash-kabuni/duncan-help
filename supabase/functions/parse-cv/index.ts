import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
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

    // Convert file to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Determine MIME type from filename
    const ext = storage_path.split(".").pop()?.toLowerCase();
    let mimeType = "application/pdf";
    if (ext === "docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (ext === "doc") mimeType = "application/msword";

    // For PDFs, use Gemini's vision capabilities to read the document
    // For non-PDF, we'll extract text first then send to AI
    const isPdf = ext === "pdf";

    let aiMessages: any[];

    if (isPdf) {
      // Use multimodal: send PDF as inline_data
      aiMessages = [
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
                filename: storage_path.split("/").pop() || "cv.pdf",
                file_data: `data:${mimeType};base64,${base64}`,
              },
            },
            {
              type: "text",
              text: "Extract the candidate's full name and email address from this CV/resume document.",
            },
          ],
        },
      ];
    } else {
      // For DOC/DOCX, try to extract raw text (limited, but best effort)
      const textContent = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(arrayBuffer));
      // Clean up binary noise, keep readable portions
      const cleanText = textContent.replace(/[^\\x20-\\x7E\\n\\r\\t]/g, " ").replace(/\s{3,}/g, " ").slice(0, 8000);

      aiMessages = [
        {
          role: "system",
          content: `You are a CV/resume parser. Extract the candidate's full name and email address from the text below.
If you cannot find an email, return null for email.
Always return the result by calling the extract_candidate_info function.`,
        },
        {
          role: "user",
          content: `Extract the candidate's full name and email from this CV text:\n\n${cleanText}`,
        },
      ];
    }

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
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

    // Extract structured result from tool call
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

    // Update the candidate record with parsed info
    const updateData: any = { name: parsedName };
    if (parsedEmail) {
      updateData.email = parsedEmail;
    }

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
