import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HIREFLIX_GQL_URL = "https://api.hireflix.com/me";

async function hireflixQuery(apiKey: string, query: string, variables?: Record<string, any>) {
  const res = await fetch(HIREFLIX_GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "Hireflix API error");
  return data.data;
}

// Fetch all interviews for a position
async function fetchPositionInterviews(apiKey: string, positionId: string) {
  const query = `
    query {
      position(id: "${positionId}") {
        interviews {
          id
          status
          candidate {
            email
            name
          }
          questions {
            id
            answer {
              transcription {
                text
              }
            }
          }
        }
      }
    }
  `;
  const data = await hireflixQuery(apiKey, query);
  return data?.position?.interviews || [];
}

// Score transcript using Lovable AI
async function scoreTranscript(transcript: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = "You are a strict hiring evaluator. Score objectively and critically. Do not inflate scores.";
  const userPrompt = `Evaluate the following interview transcript.

Return ONLY valid JSON in this exact structure:

{
  "communication_clarity": { "score": number, "reason": "text", "evidence_quote": "text" },
  "structured_thinking": { "score": number, "reason": "text", "evidence_quote": "text" },
  "role_knowledge": { "score": number, "reason": "text", "evidence_quote": "text" },
  "problem_solving": { "score": number, "reason": "text", "evidence_quote": "text" },
  "confidence_professionalism": { "score": number, "reason": "text", "evidence_quote": "text" },
  "culture_alignment": { "score": number, "reason": "text", "evidence_quote": "text" },
  "conciseness_focus": { "score": number, "reason": "text", "evidence_quote": "text" },
  "final_score": number
}

Transcript:
"""
${transcript}
"""

Do not include any explanation outside JSON.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI scoring error:", response.status, errText);
    throw new Error(`AI scoring failed: ${response.status}`);
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content || "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
  const jsonStr = (jsonMatch[1] || content).trim();

  try {
    const scores = JSON.parse(jsonStr);
    // Recalculate final_score as average of 7 metrics
    const metrics = [
      "communication_clarity", "structured_thinking", "role_knowledge",
      "problem_solving", "confidence_professionalism", "culture_alignment", "conciseness_focus"
    ];
    const avg = metrics.reduce((sum, k) => sum + (scores[k]?.score || 0), 0) / metrics.length;
    scores.final_score = Math.round(avg * 100) / 100;
    return scores;
  } catch (e) {
    console.error("Failed to parse AI scores:", jsonStr);
    throw new Error("AI returned invalid JSON");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HIREFLIX_API_KEY = Deno.env.get("HIREFLIX_API_KEY");

    if (!HIREFLIX_API_KEY) {
      return new Response(JSON.stringify({ error: "HIREFLIX_API_KEY not configured" }), {
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
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Authenticated user:", user.email);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get all candidates that were invited but not yet scored
    const { data: candidates, error: candErr } = await supabaseAdmin
      .from("candidates")
      .select("id, name, email, job_role_id, hireflix_status, hireflix_interview_id, interview_final_score")
      .eq("hireflix_status", "invited");

    if (candErr) throw candErr;
    console.log("Found invited candidates:", candidates?.length || 0, candidates?.map((c: any) => ({ id: c.id, name: c.name, email: c.email })));
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ synced: 0, scored: 0, message: "No invited candidates to sync" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique job role IDs and their hireflix position IDs
    const roleIds = [...new Set(candidates.map((c: any) => c.job_role_id).filter(Boolean))];
    const { data: roles } = await supabaseAdmin
      .from("job_roles")
      .select("id, hireflix_position_id")
      .in("id", roleIds);

    const rolePositionMap = new Map((roles || []).map((r: any) => [r.id, r.hireflix_position_id]));
    console.log("Role-position map:", JSON.stringify(Object.fromEntries(rolePositionMap)));

    // Group candidates by position
    const positionCandidates = new Map<string, any[]>();
    for (const c of candidates) {
      const posId = rolePositionMap.get(c.job_role_id);
      if (!posId) {
        console.log(`Candidate ${c.name} has no mapped position (role: ${c.job_role_id})`);
        continue;
      }
      if (!positionCandidates.has(posId)) positionCandidates.set(posId, []);
      positionCandidates.get(posId)!.push(c);
    }

    console.log("Positions to check:", [...positionCandidates.keys()]);

    let synced = 0;
    let scored = 0;
    let failed = 0;
    const results: any[] = [];

    // For each position, fetch all interviews
    for (const [positionId, posCandidates] of positionCandidates) {
      let interviews: any[];
      try {
        interviews = await fetchPositionInterviews(HIREFLIX_API_KEY, positionId);
        console.log(`Position ${positionId}: found ${interviews.length} interviews`, 
          interviews.map((i: any) => ({ email: i.candidate?.email, status: i.status })));
      } catch (e) {
        console.error(`Failed to fetch interviews for position ${positionId}:`, e);
        failed += posCandidates.length;
        continue;
      }

      // Match interviews to candidates by email
      for (const candidate of posCandidates) {
        const interview = interviews.find(
          (i: any) => i.candidate?.email?.toLowerCase() === candidate.email?.toLowerCase() && (i.status === "finished" || i.status === "completed")
        );

        if (!interview) continue; // not finished yet

        // Build transcript
        const transcript = (interview.questions || [])
          .map((q: any) => q.answer?.transcription?.text || "")
          .filter((t: string) => t.length > 0)
          .join("\n\n");

        if (!transcript) {
          console.log(`No transcript for candidate ${candidate.id}`);
          continue;
        }

        synced++;

        // Score with AI
        try {
          const scores = await scoreTranscript(transcript);

          await supabaseAdmin
            .from("candidates")
            .update({
              hireflix_status: "completed",
              hireflix_interview_id: interview.id,
              interview_transcript: transcript,
              interview_scores: scores,
              interview_final_score: scores.final_score,
              interview_scored_at: new Date().toISOString(),
            })
            .eq("id", candidate.id);

          scored++;
          results.push({ id: candidate.id, name: candidate.name, status: "scored", final_score: scores.final_score });
        } catch (e) {
          console.error(`Failed to score candidate ${candidate.id}:`, e);
          // Still save transcript and mark completed even if scoring fails
          await supabaseAdmin
            .from("candidates")
            .update({
              hireflix_status: "completed",
              hireflix_interview_id: interview.id,
              interview_transcript: transcript,
            })
            .eq("id", candidate.id);
          failed++;
          results.push({ id: candidate.id, name: candidate.name, status: "transcript_saved", error: e.message });
        }
      }
    }

    // After scoring, determine top 3 and return them
    const { data: topCandidates } = await supabaseAdmin
      .from("candidates")
      .select("id, name, email, interview_final_score, hireflix_interview_url, interview_scores")
      .not("interview_final_score", "is", null)
      .order("interview_final_score", { ascending: false })
      .limit(3);

    return new Response(JSON.stringify({
      success: true,
      synced,
      scored,
      failed,
      results,
      top_3: topCandidates || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Hireflix sync error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to sync interviews" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
