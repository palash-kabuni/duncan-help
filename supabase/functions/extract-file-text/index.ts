import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_id } = await req.json();
    if (!file_id) {
      return new Response(JSON.stringify({ error: "file_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch file record (RLS enforces ownership via project)
    const { data: fileRecord, error: fileError } = await supabase
      .from("project_files")
      .select("id, file_name, storage_path, extracted_text")
      .eq("id", file_id)
      .single();

    if (fileError || !fileRecord) {
      return new Response(JSON.stringify({ error: "File not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already extracted
    if (fileRecord.extracted_text) {
      return new Response(JSON.stringify({ 
        id: fileRecord.id, 
        file_name: fileRecord.file_name,
        extracted: true,
        text_length: fileRecord.extracted_text.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(fileRecord.storage_path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = fileRecord.file_name.toLowerCase();
    let extractedText = "";

    if (fileName.endsWith(".pdf")) {
      // Use OpenAI to extract text from PDF via base64
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: "Extract ALL text content from this PDF document. Return the raw text only, preserving structure where possible. Do not summarize or interpret.",
            },
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: fileRecord.file_name,
                    file_data: `data:application/pdf;base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: "Extract all text from this document.",
                },
              ],
            },
          ],
          max_tokens: 16000,
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        extractedText = aiData.choices?.[0]?.message?.content || "";
      } else {
        const errText = await aiResp.text();
        console.error("AI extraction error:", aiResp.status, errText);
        return new Response(JSON.stringify({ error: "Failed to extract text from PDF" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (fileName.endsWith(".docx")) {
      // Extract text from DOCX using JSZip
      const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
      const arrayBuffer = await fileData.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const documentXml = await zip.file("word/document.xml")?.async("string");

      if (documentXml) {
        // Strip XML tags to get plain text
        extractedText = documentXml
          .replace(/<w:br[^>]*\/>/g, "\n")
          .replace(/<\/w:p>/g, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#x[0-9A-Fa-f]+;/g, (match) => {
            const code = parseInt(match.slice(3, -1), 16);
            return String.fromCharCode(code);
          })
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
    } else if (
      fileName.endsWith(".txt") ||
      fileName.endsWith(".md") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".json") ||
      fileName.endsWith(".xml") ||
      fileName.endsWith(".yaml") ||
      fileName.endsWith(".yml") ||
      fileName.endsWith(".log")
    ) {
      // Plain text files
      extractedText = await fileData.text();
    } else {
      // Unsupported format — try as text
      try {
        extractedText = await fileData.text();
        // If it looks like binary, reject
        if (extractedText.includes("\0")) {
          return new Response(JSON.stringify({ error: `Unsupported file format: ${fileName.split('.').pop()}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: `Unsupported file format: ${fileName.split('.').pop()}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text could be extracted from the file" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save extracted text to DB
    const { error: updateError } = await supabase
      .from("project_files")
      .update({ extracted_text: extractedText })
      .eq("id", file_id);

    if (updateError) {
      console.error("DB update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save extracted text" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      id: fileRecord.id,
      file_name: fileRecord.file_name,
      extracted: true,
      text_length: extractedText.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-file-text error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
