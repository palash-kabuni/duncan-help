import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_QUESTIONS = [
  "Kabuni is intentional about how technology shows up in people's lives. How do you personally manage your relationship with screen time, either for yourself or within your family, and what trade-offs have you consciously made?",
  "Tell us about a time you chose a harder path that genuinely changed behaviour or outcomes, even though an easier option would have looked better on paper.",
  "Describe a situation where a small detail made a disproportionate difference to the final outcome. Why did it matter, and how did you spot it?",
  "Tell us about a time you realised you were wrong and had to change your position publicly. What was difficult about that moment, and what did you learn?",
];

async function createHireflixPosition(apiKey: string, title: string, competencies: any[]): Promise<{ id: string; name: string }> {
  // Generate competency question
  let competencyQuestion = "Based on your experience in this role, describe how you've demonstrated relevant technical or professional competencies in a real-world scenario.";

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (OPENAI_API_KEY && competencies && competencies.length > 0) {
    try {
      const competencyNames = competencies.map((c: any) => typeof c === "string" ? c : c.name || c.title).join(", ");
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: "You are an expert interviewer at Kabuni. Generate exactly ONE behavioural interview question that tests a candidate's competency in the given areas. The question should probe real behaviour and past experience, not hypotheticals. Keep it under 50 words. Return ONLY the question text, nothing else." },
            { role: "user", content: `Role: ${title}\nKey competencies: ${competencyNames}\n\nGenerate one behavioural interview question.` },
          ],
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const generated = aiData.choices?.[0]?.message?.content?.trim();
        if (generated && generated.length > 10) competencyQuestion = generated;
      }
    } catch (err) {
      console.error("Failed to generate competency question:", err);
    }
  }

  const allQuestions = [...DEFAULT_QUESTIONS, competencyQuestion];
  const escapedTitle = title.replace(/"/g, '\\"');
  const questionsGql = allQuestions.map((q) => `{ question: "${q.replace(/"/g, '\\"')}" }`).join(", ");

  const mutation = `mutation { createPosition(input: { name: "${escapedTitle}", questions: [${questionsGql}] }) { id name } }`;

  const hfRes = await fetch("https://api.hireflix.com/me", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ query: mutation }),
  });

  const hfData = await hfRes.json();
  if (hfData.errors) throw new Error(hfData.errors[0]?.message || "Hireflix API error");
  
  const position = hfData.data?.createPosition;
  if (!position?.id) throw new Error("No position ID returned");
  
  return position;
}

async function deleteHireflixPosition(apiKey: string, positionId: string): Promise<void> {
  const escapedId = positionId.replace(/"/g, '\\"');
  const mutation = `mutation { deletePosition(id: "${escapedId}") { id } }`;

  const hfRes = await fetch("https://api.hireflix.com/me", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ query: mutation }),
  });

  const hfData = await hfRes.json();
  if (hfData.errors) {
    const errMsg = hfData.errors[0]?.message || "";
    // Not found = already deleted = success
    if (errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("does not exist")) {
      console.log("Position already deleted");
      return;
    }
    throw new Error(errMsg);
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending retries that are due
    const { data: retries, error: fetchErr } = await supabaseAdmin
      .from("hireflix_retry_queue")
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;
    if (!retries || retries.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending retries" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const retry of retries) {
      // Mark as processing
      await supabaseAdmin
        .from("hireflix_retry_queue")
        .update({ status: "processing" })
        .eq("id", retry.id);

      try {
        if (retry.operation === "create_position") {
          const { job_role_id, title, competencies } = retry.payload as any;

          const position = await createHireflixPosition(HIREFLIX_API_KEY, title, competencies || []);

          // Update job role with position ID
          await supabaseAdmin
            .from("job_roles")
            .update({ hireflix_position_id: position.id })
            .eq("id", job_role_id);

          // Mark retry as completed
          await supabaseAdmin
            .from("hireflix_retry_queue")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", retry.id);

          console.log(`Retry succeeded: created position for role ${job_role_id}`);
          succeeded++;

        } else if (retry.operation === "delete_position") {
          const { hireflix_position_id } = retry.payload as any;

          await deleteHireflixPosition(HIREFLIX_API_KEY, hireflix_position_id);

          await supabaseAdmin
            .from("hireflix_retry_queue")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", retry.id);

          console.log(`Retry succeeded: deleted position ${hireflix_position_id}`);
          succeeded++;
        } else {
          throw new Error(`Unknown operation: ${retry.operation}`);
        }

        processed++;
      } catch (err) {
        const newAttempts = (retry.attempts || 0) + 1;
        const isExhausted = newAttempts >= (retry.max_attempts || 5);

        // Exponential backoff: 1min, 4min, 9min, 16min, 25min
        const delayMinutes = newAttempts * newAttempts;
        const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

        await supabaseAdmin
          .from("hireflix_retry_queue")
          .update({
            status: isExhausted ? "failed" : "pending",
            attempts: newAttempts,
            last_error: err.message || "Unknown error",
            next_retry_at: isExhausted ? retry.next_retry_at : nextRetry,
          })
          .eq("id", retry.id);

        console.error(`Retry failed for ${retry.id} (attempt ${newAttempts}):`, err.message);
        failed++;
        processed++;
      }
    }

    return new Response(JSON.stringify({ processed, succeeded, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Retry processor error:", error);
    return new Response(JSON.stringify({ error: error.message || "Retry processor failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
