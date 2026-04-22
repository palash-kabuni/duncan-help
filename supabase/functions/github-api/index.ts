import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { action } = await req.json().catch(() => ({ action: "status" }));

  if (action === "status") {
    return json({
      ok: true,
      connected: false,
      status: "not_configured",
      last_verified_at: null,
      degraded_reason: "GitHub connector not linked to this project yet",
    });
  }

  return json({
    ok: true,
    connected: false,
    status: "not_configured",
    last_verified_at: null,
    degraded_reason: "GitHub connector not linked to this project yet",
    repos_scanned: 0,
    open_prs: 0,
    blocked_prs: 0,
    stale_prs: 0,
    release_risks: 0,
    signals: [],
    summary: null,
  });
});