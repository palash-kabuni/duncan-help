import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ZipReader, BlobReader, TextWriter } from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KABUNI_VALUES = [
  {
    key: "sweat_the_detail",
    name: "Sweat the Detail",
    description: "Care deeply about the small things. Precision, quality, and reliability are non-negotiable.",
  },
  {
    key: "integrity_always",
    name: "Integrity Always",
    description: "Act with honesty, consistency, and accountability. No ego. No shortcuts.",
  },
  {
    key: "behaviour_over_attention",
    name: "Behaviour Over Attention",
    description: "Optimise for real-world impact, not clicks or noise. If it doesn't change behaviour, it doesn't matter.",
  },
  {
    key: "progress_is_collective",
    name: "Progress Is Collective",
    description: "Lift each other, celebrate progress, and design systems that help individuals, families, and communities move forward together.",
  },
  {
    key: "health_family_happiness",
    name: "Health, Family and Happiness",
    description: "Protect wellbeing, support family first, and build in ways that allow people to live healthy, balanced lives.",
  },
  {
    key: "build_for_long_term",
    name: "Build for the Long Term",
    description: "Build with purpose, patience, and ambition. Creating infrastructure, not features. A movement designed to last.",
  },
];

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    result += String.fromCharCode(...chunk);
  }
  return btoa(result);
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const blob = new Blob([bytes]);
  const reader = new ZipReader(new BlobReader(blob));
  const entries = await reader.getEntries();
  let text = "";
  for (const entry of entries) {
    if (entry.filename === "word/document.xml" && entry.getData) {
      const writer = new TextWriter();
      const xml = await entry.getData(writer);
      text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }
  await reader.close();
  return text.slice(0, 15000);
}

async function getCvContent(supabaseAdmin: any, storagePath: string): Promise<{ messages: any[] } | null> {
  const { data: fileData, error } = await supabaseAdmin.storage.from("cvs").download(storagePath);
  if (error || !fileData) return null;

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const ext = storagePath.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    // Extract text from PDF (OpenAI API doesn't accept PDF files directly)
    const textContent = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const cleanText = textContent.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").slice(0, 15000);
    if (!cleanText || cleanText.length < 20) return null;
    return {
      messages: [
        { role: "user", content: `Score this candidate's CV against the Kabuni company values described in the system prompt.\n\nCV TEXT:\n${cleanText}` },
      ],
    };
  }

  let text = "";
  if (ext === "docx") {
    text = await extractDocxText(bytes);
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    text = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").slice(0, 8000);
  }

  if (!text || text.length < 20) return null;

  return {
    messages: [
      { role: "user", content: `Score this candidate's CV against the Kabuni company values described in the system prompt.\n\nCV TEXT:\n${text}` },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body - optionally filter by candidate_id
    const body = await req.json().catch(() => ({}));
    const candidateId = body.candidate_id;

    // Fetch candidates to score
    let query = supabaseAdmin.from("candidates").select("*").not("cv_storage_path", "is", null);
    if (candidateId) {
      query = query.eq("id", candidateId);
    }
    const { data: candidates, error: fetchError } = await query;

    if (fetchError || !candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No candidates with CVs found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valuesDescription = KABUNI_VALUES.map((v, i) => `${i + 1}. ${v.name}: ${v.description}`).join("\n");

    const systemPrompt = `You are an expert recruitment assessor for Kabuni. Your task is to critically evaluate a candidate's CV against Kabuni's 6 core values.

For EACH value, score the candidate from 1-5 based on evidence in their CV:
1 = No evidence at all
2 = Minimal/weak evidence  
3 = Some evidence but not strong
4 = Good evidence demonstrated
5 = Exceptional, clear and strong evidence

Be CRITICAL and evidence-based. Do not give high scores without clear justification from the CV content. Look for:
- Specific examples, achievements, or responsibilities that demonstrate each value
- Language and emphasis that suggests alignment
- Career choices and patterns that reflect the value

The 6 Kabuni Core Values:
${valuesDescription}

You MUST call the score_values function with your assessment.`;

    const toolDef = {
      type: "function",
      function: {
        name: "score_values",
        description: "Submit the values-based scoring for a candidate",
        parameters: {
          type: "object",
          properties: {
            sweat_the_detail: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 1, maximum: 5 },
                justification: { type: "string", description: "Brief evidence-based justification (1-2 sentences)" },
              },
              required: ["score", "justification"],
              additionalProperties: false,
            },
            integrity_always: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 1, maximum: 5 },
                justification: { type: "string" },
              },
              required: ["score", "justification"],
              additionalProperties: false,
            },
            behaviour_over_attention: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 1, maximum: 5 },
                justification: { type: "string" },
              },
              required: ["score", "justification"],
              additionalProperties: false,
            },
            progress_is_collective: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 1, maximum: 5 },
                justification: { type: "string" },
              },
              required: ["score", "justification"],
              additionalProperties: false,
            },
            health_family_happiness: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 1, maximum: 5 },
                justification: { type: "string" },
              },
              required: ["score", "justification"],
              additionalProperties: false,
            },
            build_for_long_term: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 1, maximum: 5 },
                justification: { type: "string" },
              },
              required: ["score", "justification"],
              additionalProperties: false,
            },
          },
          required: ["sweat_the_detail", "integrity_always", "behaviour_over_attention", "progress_is_collective", "health_family_happiness", "build_for_long_term"],
          additionalProperties: false,
        },
      },
    };

    let scored = 0;
    let failed = 0;
    const results: any[] = [];

    for (const candidate of candidates) {
      try {
        const cvContent = await getCvContent(supabaseAdmin, candidate.cv_storage_path!);
        if (!cvContent) {
          failed++;
          continue;
        }

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "system", content: systemPrompt }, ...cvContent.messages],
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "score_values" } },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`AI error for ${candidate.id}:`, aiResponse.status, errText);
          if (aiResponse.status === 429) {
            // Rate limited — stop processing more
            return new Response(JSON.stringify({ error: "Rate limited. Try again shortly.", scored, failed }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (aiResponse.status === 402) {
            return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          failed++;
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          console.error(`No tool call for candidate ${candidate.id}`);
          failed++;
          continue;
        }

        const scores = JSON.parse(toolCall.function.arguments);

        // Calculate overall values score (average of 6 values, out of 5)
        const allScores = KABUNI_VALUES.map((v) => scores[v.key]?.score ?? 0);
        const valuesAvg = allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length;
        const valuesScore = Math.round(valuesAvg * 10) / 10; // 1 decimal

        // Merge with existing scoring_details
        const existingDetails = (candidate.scoring_details as any) || {};
        const newDetails = { ...existingDetails, values: scores };

        const { error: updateError } = await supabaseAdmin
          .from("candidates")
          .update({
            values_score: valuesScore,
            scoring_details: newDetails,
            status: candidate.competency_score ? "scored" : "values_scored",
          })
          .eq("id", candidate.id);

        if (updateError) {
          console.error(`Update error for ${candidate.id}:`, updateError);
          failed++;
          continue;
        }

        results.push({ id: candidate.id, name: candidate.name, values_score: valuesScore });
        scored++;
      } catch (err) {
        console.error(`Error scoring candidate ${candidate.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, scored, failed, total: candidates.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Score CV values error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to score CVs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
