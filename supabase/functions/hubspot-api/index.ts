import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function verifyCredentials(lovableKey: string, hubspotKey: string) {
  const res = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": hubspotKey,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

async function gateway(path: string, lovableKey: string, hubspotKey: string) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": hubspotKey,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HubSpot gateway failed [${res.status}]: ${JSON.stringify(data).slice(0, 240)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { action } = await req.json().catch(() => ({ action: "status" }));
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");

  if (!LOVABLE_API_KEY || !HUBSPOT_API_KEY) {
    return json({
      ok: true,
      connected: false,
      status: "not_configured",
      last_verified_at: null,
      degraded_reason: "HubSpot connector not linked",
      accounts_scanned: 0,
      stale_deals: 0,
      at_risk_accounts: 0,
      customer_escalations: 0,
      signals: [],
      summary: null,
    });
  }

  try {
    const verify = await verifyCredentials(LOVABLE_API_KEY, HUBSPOT_API_KEY);
    if (!verify.ok || verify.data?.outcome === "failed") {
      return json({
        ok: true,
        connected: false,
        status: "degraded",
        last_verified_at: new Date().toISOString(),
        degraded_reason: verify.data?.error || "Credential verification failed",
        accounts_scanned: 0,
        stale_deals: 0,
        at_risk_accounts: 0,
        customer_escalations: 0,
        signals: [],
        summary: null,
      });
    }

    if (action === "status") {
      return json({ ok: true, connected: true, status: "connected", last_verified_at: new Date().toISOString(), degraded_reason: null });
    }

    const [companies, deals] = await Promise.all([
      gateway("/crm/v3/objects/companies?limit=25&properties=name,hs_lastmodifieddate,hubspotscore", LOVABLE_API_KEY, HUBSPOT_API_KEY),
      gateway("/crm/v3/objects/deals?limit=25&properties=dealname,dealstage,hs_lastmodifieddate,amount", LOVABLE_API_KEY, HUBSPOT_API_KEY),
    ]);

    const companyResults = Array.isArray(companies?.results) ? companies.results : [];
    const dealResults = Array.isArray(deals?.results) ? deals.results : [];
    const staleDeals = dealResults.filter((deal: any) => {
      const ts = Date.parse(deal?.properties?.hs_lastmodifieddate || "");
      return Number.isFinite(ts) && ts < Date.now() - 14 * 24 * 60 * 60 * 1000;
    });
    const atRiskAccounts = companyResults.filter((company: any) => Number(company?.properties?.hubspotscore || 0) < 20);

    const signals = [
      ...staleDeals.slice(0, 3).map((deal: any) => ({ type: "stale_deal", label: deal?.properties?.dealname || "Unnamed deal", stage: deal?.properties?.dealstage || null })),
      ...atRiskAccounts.slice(0, 3).map((company: any) => ({ type: "at_risk_account", label: company?.properties?.name || "Unnamed company" })),
    ];

    return json({
      ok: true,
      connected: true,
      status: "connected",
      last_verified_at: new Date().toISOString(),
      degraded_reason: null,
      accounts_scanned: companyResults.length,
      stale_deals: staleDeals.length,
      at_risk_accounts: atRiskAccounts.length,
      customer_escalations: 0,
      signals,
      summary: companyResults.length === 0 && dealResults.length === 0
        ? "HubSpot connected but returned no recent CRM records."
        : `${staleDeals.length} stale deals and ${atRiskAccounts.length} low-score accounts across ${companyResults.length} scanned accounts.`,
    });
  } catch (error) {
    return json({
      ok: true,
      connected: false,
      status: "degraded",
      last_verified_at: new Date().toISOString(),
      degraded_reason: error instanceof Error ? error.message : "HubSpot summary failed",
      accounts_scanned: 0,
      stale_deals: 0,
      at_risk_accounts: 0,
      customer_escalations: 0,
      signals: [],
      summary: null,
    });
  }
});