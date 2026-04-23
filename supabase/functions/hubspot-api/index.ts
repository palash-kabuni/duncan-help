import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";
const VERIFY_URL = "https://connector-gateway.lovable.dev/api/v1/verify_credentials";
const HUBSPOT_API = "https://api.hubapi.com";

type Status = "connected" | "not_configured" | "degraded";

type HubspotSummary = {
  ok: boolean;
  connected: boolean;
  status: Status;
  last_verified_at: string | null;
  last_sync_at: string | null;
  degraded_reason: string | null;
  error_code: string | null;
  error_message: string | null;
  metrics_summary: string | null;
  accounts_scanned: number;
  stale_deals: number;
  at_risk_accounts: number;
  customer_escalations: number;
  signals: Array<Record<string, unknown>>;
  summary: string | null;
};

function baseResponse(overrides: Partial<HubspotSummary> = {}): HubspotSummary {
  return {
    ok: true,
    connected: false,
    status: "not_configured",
    last_verified_at: null,
    last_sync_at: null,
    degraded_reason: null,
    error_code: null,
    error_message: null,
    metrics_summary: null,
    accounts_scanned: 0,
    stale_deals: 0,
    at_risk_accounts: 0,
    customer_escalations: 0,
    signals: [],
    summary: null,
    ...overrides,
  };
}

function logHubspot(event: string, details: Record<string, unknown>) {
  console.log(`[hubspot-api] ${event}`, details);
}

function buildResponse(overrides: Partial<HubspotSummary> = {}) {
  const merged = baseResponse(overrides);
  const errorMessage = merged.error_message ?? merged.degraded_reason ?? null;
  const metricsSummary = merged.metrics_summary ?? merged.summary ?? null;
  return {
    ...merged,
    last_sync_at: merged.last_sync_at ?? merged.last_verified_at,
    degraded_reason: errorMessage,
    error_message: errorMessage,
    metrics_summary: metricsSummary,
  } satisfies HubspotSummary;
}

function responseWithLogging(overrides: Partial<HubspotSummary> = {}) {
  const response = buildResponse(overrides);
  logHubspot("returning status", {
    status: response.status,
    connected: response.connected,
    error_code: response.error_code,
    error_message: response.error_message,
  });
  return json(response);
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function getStoredToken() {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await supabase
    .from("company_integrations")
    .select("encrypted_api_key, status, last_sync")
    .eq("integration_id", "hubspot")
    .maybeSingle();

  if (!data?.encrypted_api_key) return null;

  try {
    return {
      token: atob(data.encrypted_api_key),
      lastSync: data.last_sync ?? null,
      storedStatus: data.status ?? null,
    };
  } catch {
    return {
      token: null,
      lastSync: data.last_sync ?? null,
      storedStatus: data.status ?? null,
    };
  }
}

async function verifyGatewayCredentials(lovableKey: string, hubspotKey: string) {
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": hubspotKey,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, status: res.status };
}

async function hubspotGateway(path: string, lovableKey: string, hubspotKey: string) {
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

async function hubspotApi(path: string, token: string) {
  const res = await fetch(`${HUBSPOT_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HubSpot API failed [${res.status}]: ${JSON.stringify(data).slice(0, 240)}`);
  return data;
}

function summarise(companies: any, deals: any, lastVerifiedAt: string, degradedReason: string | null = null, errorCode: string | null = null) {
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
  const summary = companyResults.length === 0 && dealResults.length === 0
    ? "HubSpot connected but returned no recent CRM records."
    : `${staleDeals.length} stale deals and ${atRiskAccounts.length} low-score accounts across ${companyResults.length} scanned accounts.`;

  return buildResponse({
    connected: true,
    status: degradedReason ? "degraded" : "connected",
    last_verified_at: lastVerifiedAt,
    last_sync_at: lastVerifiedAt,
    degraded_reason: degradedReason,
    error_code: errorCode,
    error_message: degradedReason,
    accounts_scanned: companyResults.length,
    stale_deals: staleDeals.length,
    at_risk_accounts: atRiskAccounts.length,
    customer_escalations: 0,
    signals,
    summary,
    metrics_summary: summary,
  });
}

function classifyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/401|403|unauthorized|forbidden|invalid.+token|expired/i.test(message)) {
    return { error_code: "upstream_auth_failed", status: "degraded" as Status };
  }
  return { error_code: "upstream_request_failed", status: "degraded" as Status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { action } = await req.json().catch(() => ({ action: "status" }));
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
  const verifiedAt = new Date().toISOString();

  try {
    if (LOVABLE_API_KEY && HUBSPOT_API_KEY) {
      logHubspot("credential source", { source: "connector_gateway" });
      const verify = await verifyGatewayCredentials(LOVABLE_API_KEY, HUBSPOT_API_KEY);
      logHubspot("verification outcome", { ok: verify.ok, status: verify.status, outcome: verify.data?.outcome ?? null });
      if (!verify.ok || verify.data?.outcome === "failed") {
        return responseWithLogging({
          status: "degraded",
          last_verified_at: verifiedAt,
          last_sync_at: verifiedAt,
          error_code: "connector_verification_failed",
          error_message: verify.data?.error || "HubSpot connector verification failed",
        });
      }

      if (action === "status") {
        return responseWithLogging({ connected: true, status: "connected", last_verified_at: verifiedAt, last_sync_at: verifiedAt });
      }

      const [companies, deals] = await Promise.all([
        hubspotGateway("/crm/v3/objects/companies?limit=25&properties=name,hs_lastmodifieddate,hubspotscore", LOVABLE_API_KEY, HUBSPOT_API_KEY),
        hubspotGateway("/crm/v3/objects/deals?limit=25&properties=dealname,dealstage,hs_lastmodifieddate,amount", LOVABLE_API_KEY, HUBSPOT_API_KEY),
      ]);
      return json(summarise(companies, deals, verifiedAt));
    }

    logHubspot("credential source", { source: "stored_token" });
    const stored = await getStoredToken();
    if (!stored) {
      logHubspot("missing token branch", { branch: "stored_token_missing" });
      return responseWithLogging({
        status: "not_configured",
        last_verified_at: null,
        last_sync_at: null,
        error_code: "stored_token_missing",
        error_message: "HubSpot token not configured",
      });
    }

    if (!stored.token) {
      logHubspot("decode failure branch", { branch: "stored_token_decode_failed", stored_status: stored.storedStatus });
      return responseWithLogging({
        status: "degraded",
        last_verified_at: stored.lastSync ?? verifiedAt,
        last_sync_at: stored.lastSync ?? verifiedAt,
        error_code: "stored_token_decode_failed",
        error_message: "Stored HubSpot token could not be decoded",
      });
    }

    await hubspotApi("/crm/v3/objects/companies?limit=1&properties=name", stored.token);
    if (action === "status") {
      return responseWithLogging({ connected: true, status: "connected", last_verified_at: verifiedAt, last_sync_at: stored.lastSync ?? verifiedAt });
    }

    const [companies, deals] = await Promise.all([
      hubspotApi("/crm/v3/objects/companies?limit=25&properties=name,hs_lastmodifieddate,hubspotscore", stored.token),
      hubspotApi("/crm/v3/objects/deals?limit=25&properties=dealname,dealstage,hs_lastmodifieddate,amount", stored.token),
    ]);

    return json(summarise(companies, deals, stored.lastSync ?? verifiedAt));
  } catch (error) {
    const classification = classifyError(error);
    logHubspot("upstream failure", { error_code: classification.error_code, message: error instanceof Error ? error.message : String(error) });
    return responseWithLogging({
      status: classification.status,
      connected: false,
      last_verified_at: verifiedAt,
      last_sync_at: verifiedAt,
      error_code: classification.error_code,
      error_message: error instanceof Error ? error.message : "HubSpot summary failed",
    });
  }
});
