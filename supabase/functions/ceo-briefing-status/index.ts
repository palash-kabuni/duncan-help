// Lightweight poller for ceo-briefing background jobs.
// Returns the latest status/phase/progress for a given job_id.
// CEO-only — same auth gate as ceo-briefing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CEO_EMAILS = ["nimesh@kabuni.com", "palash@kabuni.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const email = (claimsData.claims.email as string | undefined)?.toLowerCase() ?? "";
    if (!CEO_EMAILS.includes(email)) return json({ error: "Forbidden — CEO only" }, 403);

    const userId = claimsData.claims.sub as string;

    // job_id can come from query string (GET-style) or JSON body (POST).
    let jobId: string | null = null;
    const url = new URL(req.url);
    jobId = url.searchParams.get("job_id");
    if (!jobId && req.method !== "GET") {
      try {
        const body = await req.json();
        jobId = body?.job_id ?? null;
      } catch {
        // ignore
      }
    }
    if (!jobId) return json({ error: "Missing job_id" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job, error } = await admin
      .from("ceo_briefing_jobs")
      .select("id, user_id, status, progress, phase, briefing_id, error, created_at, updated_at")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      console.error("status query error:", error);
      return json({ error: error.message }, 500);
    }
    if (!job) return json({ error: "Job not found" }, 404);
    if (job.user_id !== userId) return json({ error: "Forbidden" }, 403);

    return json({
      job_id: job.id,
      status: job.status,
      progress: job.progress,
      phase: job.phase,
      briefing_id: job.briefing_id,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  } catch (e: any) {
    console.error("ceo-briefing-status fatal:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
