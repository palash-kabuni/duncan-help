import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchHireflixPositions(apiKey: string): Promise<any[]> {
  const query = `query { positions { id name } }`;
  const res = await fetch("https://api.hireflix.com/me", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ query }),
  });
  const rawText = await res.text();
  console.log("Hireflix raw API response status:", res.status, "body:", rawText);
  try {
    const data = JSON.parse(rawText);
    return data.data?.positions || [];
  } catch {
    return [];
  }
}

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
    const { candidate_ids } = body;

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return new Response(JSON.stringify({ error: "candidate_ids array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch candidates with their job role info
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("candidates")
      .select("id, name, email, hireflix_status, job_role_id")
      .in("id", candidate_ids);

    if (fetchError || !candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No candidates found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique job_role_ids from selected candidates
    const roleIds = [...new Set(candidates.map((c: any) => c.job_role_id).filter(Boolean))];

    // Fetch job roles to get hireflix_position_id and title
    const { data: roles } = await supabaseAdmin
      .from("job_roles")
      .select("id, title, hireflix_position_id")
      .in("id", roleIds);

    const roleMap = new Map((roles || []).map((r: any) => [r.id, r]));

    // Check if any roles are missing hireflix_position_id — auto-match from Hireflix
    const unmappedRoles = (roles || []).filter((r: any) => !r.hireflix_position_id);
    if (unmappedRoles.length > 0) {
      const hfPositions = await fetchHireflixPositions(HIREFLIX_API_KEY);
      console.log("Hireflix positions returned:", JSON.stringify(hfPositions.map((p: any) => ({ id: p.id, name: p.name, status: p.status }))));
      console.log("Unmapped roles to match:", JSON.stringify(unmappedRoles.map((r: any) => ({ id: r.id, title: r.title }))));

      for (const role of unmappedRoles) {
        // Fuzzy match: case-insensitive title contains
        const match = hfPositions.find((p: any) =>
          p.name?.toLowerCase().includes(role.title.toLowerCase()) ||
          role.title.toLowerCase().includes(p.name?.toLowerCase())
        );
        if (match) {
          // Save the mapping for future use
          await supabaseAdmin
            .from("job_roles")
            .update({ hireflix_position_id: match.id })
            .eq("id", role.id);
          role.hireflix_position_id = match.id;
          roleMap.set(role.id, role);
        }
      }
    }

    let invited = 0;
    let failed = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const candidate of candidates) {
      if (!candidate.email) {
        skipped++;
        results.push({ id: candidate.id, name: candidate.name, status: "skipped", reason: "no email" });
        continue;
      }

      if (candidate.hireflix_status === "invited" || candidate.hireflix_status === "completed") {
        skipped++;
        results.push({ id: candidate.id, name: candidate.name, status: "skipped", reason: `already ${candidate.hireflix_status}` });
        continue;
      }

      const role = roleMap.get(candidate.job_role_id);
      const positionId = role?.hireflix_position_id;

      if (!positionId) {
        failed++;
        const reason = !candidate.job_role_id
          ? "candidate has no job role assigned"
          : `no Hireflix position matched for role "${role?.title || "unknown"}"`;
        results.push({ id: candidate.id, name: candidate.name, status: "failed", reason });
        continue;
      }

      try {
        const fullName = (candidate.name || "").trim();

        const mutation = `
          mutation {
            Position(id: "${positionId}") {
              invite(candidate: { name: "${fullName}", email: "${candidate.email}" }) {
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
          console.error(`Hireflix error for ${candidate.id}:`, JSON.stringify(gqlData.errors));
          failed++;
          results.push({ id: candidate.id, name: candidate.name, status: "failed", reason: gqlData.errors[0]?.message });
          continue;
        }

        const interview = gqlData.data?.Position?.invite;
        const interviewUrl = interview?.url?.short || interview?.url?.public || null;

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
