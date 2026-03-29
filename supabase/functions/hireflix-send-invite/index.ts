import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HIREFLIX_API_KEY = Deno.env.get("HIREFLIX_API_KEY");

    if (!HIREFLIX_API_KEY) {
      return new Response(JSON.stringify({ error: "HIREFLIX_API_KEY not configured." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: use getUser() instead of broken getClaims()
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { candidate_ids } = body;

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return new Response(JSON.stringify({ error: "candidate_ids array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch candidates
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("candidates")
      .select("id, name, email, hireflix_status, job_role_id")
      .in("id", candidate_ids);

    if (fetchError || !candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No candidates found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get role → hireflix_position_id mapping (NO fuzzy matching)
    const roleIds = [...new Set(candidates.map((c: any) => c.job_role_id).filter(Boolean))];
    const { data: roles } = await supabaseAdmin
      .from("job_roles")
      .select("id, title, hireflix_position_id")
      .in("id", roleIds);

    const roleMap = new Map((roles || []).map((r: any) => [r.id, r]));

    let invited = 0;
    let failed = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const candidate of candidates) {
      // Skip if no email
      if (!candidate.email) {
        failed++;
        results.push({ id: candidate.id, name: candidate.name, status: "failed", reason: "Candidate email missing" });
        continue;
      }

      // Skip already invited/completed
      if (candidate.hireflix_status === "invited" || candidate.hireflix_status === "completed") {
        skipped++;
        results.push({ id: candidate.id, name: candidate.name, status: "skipped", reason: `Already ${candidate.hireflix_status}` });
        continue;
      }

      // Check role mapping - MUST have hireflix_position_id
      if (!candidate.job_role_id) {
        failed++;
        results.push({ id: candidate.id, name: candidate.name, status: "failed", reason: "No job role assigned" });
        continue;
      }

      const role = roleMap.get(candidate.job_role_id);
      const positionId = role?.hireflix_position_id;

      if (!positionId) {
        failed++;
        results.push({
          id: candidate.id,
          name: candidate.name,
          status: "failed",
          reason: `Role "${role?.title || "unknown"}" not linked to Hireflix. Link it first in Job Roles.`,
        });
        continue;
      }

      // Send invite via GraphQL - properly escaped variables
      try {
        const fullName = (candidate.name || "").trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const email = candidate.email.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

        const mutation = `
          mutation {
            Position(id: "${positionId}") {
              invite(candidate: { name: "${fullName}", email: "${email}" }) {
                id
                url {
                  public
                  short
                }
              }
            }
          }
        `;

        const gqlResponse = await fetch("https://api.hireflix.com/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": HIREFLIX_API_KEY,
          },
          body: JSON.stringify({ query: mutation }),
        });

        const gqlData = await gqlResponse.json();

        if (gqlData.errors) {
          console.error(`Hireflix API error for ${candidate.id}:`, JSON.stringify(gqlData.errors));
          failed++;
          results.push({
            id: candidate.id,
            name: candidate.name,
            status: "failed",
            reason: `Hireflix API: ${gqlData.errors[0]?.message || "Unknown API error"}`,
          });
          continue;
        }

        const interview = gqlData.data?.Position?.invite;
        const interviewUrl = interview?.url?.short || interview?.url?.public || null;
        const hireflixCandidateId = interview?.id || null;

        await supabaseAdmin
          .from("candidates")
          .update({
            hireflix_status: "invited",
            hireflix_interview_url: interviewUrl,
            hireflix_candidate_id: hireflixCandidateId,
            hireflix_invited_at: new Date().toISOString(),
            failure_reason: null,
          })
          .eq("id", candidate.id);

        invited++;
        results.push({
          id: candidate.id,
          name: candidate.name,
          status: "invited",
          url: interviewUrl,
          hireflix_candidate_id: hireflixCandidateId,
        });
      } catch (err) {
        console.error(`Error inviting candidate ${candidate.id}:`, err);
        failed++;
        const reason = err.message || "Unknown error during invite";
        // Store failure reason in DB
        await supabaseAdmin
          .from("candidates")
          .update({ failure_reason: reason })
          .eq("id", candidate.id);

        // Queue for automatic retry (check for existing pending retry to prevent duplicates)
        const { data: existingRetry } = await supabaseAdmin
          .from("hireflix_retry_queue")
          .select("id")
          .eq("operation", "send_invite")
          .eq("status", "pending")
          .contains("payload", { candidate_id: candidate.id })
          .maybeSingle();

        if (!existingRetry) {
          await supabaseAdmin.from("hireflix_retry_queue").insert({
            operation: "send_invite",
            payload: {
              candidate_id: candidate.id,
              candidate_name: candidate.name,
              candidate_email: candidate.email,
              position_id: positionId,
            },
            status: "pending",
            next_retry_at: new Date(Date.now() + 60 * 1000).toISOString(),
          });
          console.log(`Queued retry for candidate ${candidate.id}`);
        }

        results.push({ id: candidate.id, name: candidate.name, status: "failed", reason, retryQueued: !existingRetry });
      }
    }

    return new Response(
      JSON.stringify({ success: true, invited, failed, skipped, total: candidates.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Hireflix send invite error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send Hireflix invites" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
