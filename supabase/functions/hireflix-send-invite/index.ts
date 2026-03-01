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
      return new Response(JSON.stringify({ error: "HIREFLIX_API_KEY not configured. Please add it in project secrets." }), {
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { candidate_ids, position_id } = body;

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return new Response(JSON.stringify({ error: "candidate_ids array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!position_id) {
      return new Response(JSON.stringify({ error: "position_id (Hireflix position ID) is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch candidate details
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("candidates")
      .select("id, name, email, hireflix_status")
      .in("id", candidate_ids);

    if (fetchError || !candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No candidates found for the given IDs" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let invited = 0;
    let failed = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const candidate of candidates) {
      // Skip candidates without email
      if (!candidate.email) {
        skipped++;
        results.push({ id: candidate.id, name: candidate.name, status: "skipped", reason: "no email" });
        continue;
      }

      // Skip already invited candidates
      if (candidate.hireflix_status === "invited" || candidate.hireflix_status === "completed") {
        skipped++;
        results.push({ id: candidate.id, name: candidate.name, status: "skipped", reason: `already ${candidate.hireflix_status}` });
        continue;
      }

      try {
        // Split name into first/last
        const nameParts = (candidate.name || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Hireflix GraphQL invite mutation
        const mutation = `
          mutation InviteCandidate($positionId: ID!, $firstName: String!, $lastName: String!, $email: String!) {
            invite(positionId: $positionId, firstName: $firstName, lastName: $lastName, email: $email) {
              id
              hash
              url
              status
            }
          }
        `;

        const gqlResponse = await fetch("https://api.hireflix.com/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${HIREFLIX_API_KEY}`,
          },
          body: JSON.stringify({
            query: mutation,
            variables: {
              positionId: position_id,
              firstName,
              lastName,
              email: candidate.email,
            },
          }),
        });

        const gqlData = await gqlResponse.json();

        if (gqlData.errors) {
          console.error(`Hireflix error for ${candidate.id}:`, JSON.stringify(gqlData.errors));
          failed++;
          results.push({ id: candidate.id, name: candidate.name, status: "failed", reason: gqlData.errors[0]?.message });
          continue;
        }

        const interview = gqlData.data?.invite;
        const interviewUrl = interview?.url || null;

        // Update candidate record
        await supabaseAdmin
          .from("candidates")
          .update({
            hireflix_status: "invited",
            hireflix_interview_url: interviewUrl,
            hireflix_invited_at: new Date().toISOString(),
          })
          .eq("id", candidate.id);

        invited++;
        results.push({ id: candidate.id, name: candidate.name, status: "invited", url: interviewUrl });
      } catch (err) {
        console.error(`Error inviting candidate ${candidate.id}:`, err);
        failed++;
        results.push({ id: candidate.id, name: candidate.name, status: "failed", reason: err.message });
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
