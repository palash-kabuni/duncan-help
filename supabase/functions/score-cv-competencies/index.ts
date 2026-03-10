import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ZipReader, BlobReader, TextWriter } from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    result += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(result);
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const reader = new ZipReader(new BlobReader(new Blob([bytes])));
  const entries = await reader.getEntries();
  let text = "";
  for (const entry of entries) {
    if (entry.filename === "word/document.xml" && entry.getData) {
      const xml = await entry.getData(new TextWriter());
      text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }
  await reader.close();
  return text.slice(0, 15000);
}

async function getCvContent(supabaseAdmin: any, storagePath: string): Promise<any[] | null> {
  const { data: fileData, error } = await supabaseAdmin.storage.from("cvs").download(storagePath);
  if (error || !fileData) return null;

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const ext = storagePath.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const base64 = uint8ToBase64(bytes);
    return [{
      role: "user",
      content: [
        { type: "file", file: { filename: storagePath.split("/").pop() || "cv.pdf", file_data: `data:application/pdf;base64,${base64}` } },
        { type: "text", text: "Score this candidate's CV against the competencies listed in the system prompt." },
      ],
    }];
  }

  let text = "";
  if (ext === "docx") {
    text = await extractDocxText(bytes);
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").slice(0, 8000);
  }
  if (!text || text.length < 20) return null;

  return [{ role: "user", content: `Score this candidate's CV against the competencies listed in the system prompt.\n\nCV TEXT:\n${text}` }];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidates that have a matched job role and a CV
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("candidates")
      .select("*")
      .not("cv_storage_path", "is", null)
      .not("job_role_id", "is", null);

    if (fetchError || !candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No matched candidates with CVs found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all relevant job roles with competencies
    const roleIds = [...new Set(candidates.map((c: any) => c.job_role_id))];
    const { data: roles } = await supabaseAdmin
      .from("job_roles")
      .select("id, title, competencies")
      .in("id", roleIds);

    const roleMap = new Map((roles || []).map((r: any) => [r.id, r]));

    let scored = 0;
    let failed = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const candidate of candidates) {
      const role = roleMap.get(candidate.job_role_id);
      const competencies = role?.competencies;

      if (!competencies || !Array.isArray(competencies) || competencies.length === 0) {
        skipped++;
        continue;
      }

      try {
        const cvMessages = await getCvContent(supabaseAdmin, candidate.cv_storage_path!);
        if (!cvMessages) { failed++; continue; }

        // Build dynamic tool schema from competencies
        const properties: any = {};
        const required: string[] = [];
        competencies.forEach((comp: any, i: number) => {
          const key = `competency_${i}`;
          properties[key] = {
            type: "object",
            properties: {
              score: { type: "number", minimum: 1, maximum: 5 },
              justification: { type: "string", description: "Brief evidence-based justification" },
            },
            required: ["score", "justification"],
            additionalProperties: false,
          };
          required.push(key);
        });

        const competencyList = competencies.map((c: any, i: number) =>
          `${i + 1}. ${c.name}: ${c.description}`
        ).join("\n");

        const systemPrompt = `You are an expert recruitment assessor. Score this candidate's CV against the following competencies for the "${role.title}" role.

For EACH competency, score 1-5:
1 = No evidence
2 = Minimal evidence
3 = Some evidence
4 = Good evidence
5 = Exceptional evidence

Be CRITICAL. Only give high scores with clear CV evidence.

Competencies:
${competencyList}

Call score_competencies with your assessment. Use keys competency_0, competency_1, etc. matching the order above.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-5-mini",
            messages: [{ role: "system", content: systemPrompt }, ...cvMessages],
            tools: [{
              type: "function",
              function: {
                name: "score_competencies",
                description: "Submit competency scores for the candidate",
                parameters: { type: "object", properties, required, additionalProperties: false },
              },
            }],
            tool_choice: { type: "function", function: { name: "score_competencies" } },
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI error for ${candidate.id}:`, aiResponse.status);
          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limited. Try again shortly.", scored, failed }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (aiResponse.status === 402) {
            return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          failed++;
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) { failed++; continue; }

        const rawScores = JSON.parse(toolCall.function.arguments);

        // Map back to competency names
        const competencyScores: any = {};
        competencies.forEach((comp: any, i: number) => {
          const key = `competency_${i}`;
          competencyScores[comp.name] = rawScores[key] || { score: 0, justification: "Not scored" };
        });

        // Average
        const allScores = Object.values(competencyScores).map((v: any) => v.score || 0);
        const avg = allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length;
        const competencyScore = Math.round(avg * 10) / 10;

        // Calculate total (values + competency average)
        const valuesScore = candidate.values_score || 0;
        const totalScore = Math.round(((valuesScore + competencyScore) / 2) * 10) / 10;

        const existingDetails = (candidate.scoring_details as any) || {};
        const newDetails = { ...existingDetails, competencies: competencyScores };

        await supabaseAdmin
          .from("candidates")
          .update({
            competency_score: competencyScore,
            total_score: totalScore,
            scoring_details: newDetails,
            status: "scored",
          })
          .eq("id", candidate.id);

        results.push({ id: candidate.id, name: candidate.name, competency_score: competencyScore, total_score: totalScore });
        scored++;
      } catch (err) {
        console.error(`Error scoring ${candidate.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, scored, failed, skipped, total: candidates.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Score competencies error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to score competencies" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
