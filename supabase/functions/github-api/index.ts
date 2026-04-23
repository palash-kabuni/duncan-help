import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GITHUB_API = "https://api.github.com";

type Status = "connected" | "not_configured" | "degraded";

type GithubSummary = {
  ok: boolean;
  connected: boolean;
  status: Status;
  last_verified_at: string | null;
  last_sync_at: string | null;
  degraded_reason: string | null;
  error_code: string | null;
  error_message: string | null;
  metrics_summary: string | null;
  repos_scanned: number;
  open_prs: number;
  blocked_prs: number;
  stale_prs: number;
  release_risks: number;
  signals: Array<Record<string, unknown>>;
  summary: string | null;
};

function baseResponse(overrides: Partial<GithubSummary> = {}): GithubSummary {
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
    repos_scanned: 0,
    open_prs: 0,
    blocked_prs: 0,
    stale_prs: 0,
    release_risks: 0,
    signals: [],
    summary: null,
    ...overrides,
  };
}

function logGithub(event: string, details: Record<string, unknown>) {
  console.log(`[github-api] ${event}`, details);
}

function buildResponse(overrides: Partial<GithubSummary> = {}) {
  const merged = baseResponse(overrides);
  const errorMessage = merged.error_message ?? merged.degraded_reason ?? null;
  const metricsSummary = merged.metrics_summary ?? merged.summary ?? null;
  return {
    ...merged,
    last_sync_at: merged.last_sync_at ?? merged.last_verified_at,
    degraded_reason: errorMessage,
    error_message: errorMessage,
    metrics_summary: metricsSummary,
  } satisfies GithubSummary;
}

function responseWithLogging(overrides: Partial<GithubSummary> = {}) {
  const response = buildResponse(overrides);
  logGithub("returning status", {
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
    .eq("integration_id", "github")
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

async function githubRequest<T>(path: string, token: string) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "duncan-team-briefing",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`GitHub API failed [${res.status}]: ${JSON.stringify(data).slice(0, 240)}`);
  }
  return data as T;
}

function classifyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/401|403|unauthorized|forbidden|bad credentials|expired/i.test(message)) {
    return { error_code: "upstream_auth_failed", status: "degraded" as Status };
  }
  return { error_code: "summary_failed", status: "degraded" as Status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { action } = await req.json().catch(() => ({ action: "status" }));
  const stored = await getStoredToken();

  if (!stored) {
    logGithub("missing token branch", { branch: "stored_token_missing" });
    return responseWithLogging({
      status: "not_configured",
      error_code: "stored_token_missing",
      error_message: "GitHub token not configured",
    });
  }

  if (!stored.token) {
    logGithub("decode failure branch", { branch: "stored_token_decode_failed", stored_status: stored.storedStatus });
    return responseWithLogging({
      status: "degraded",
      last_verified_at: stored.lastSync ?? new Date().toISOString(),
      last_sync_at: stored.lastSync ?? new Date().toISOString(),
      error_code: "stored_token_decode_failed",
      error_message: "Stored GitHub token could not be decoded",
    });
  }

  try {
    const verifiedAt = new Date().toISOString();
    logGithub("credential source", { source: "stored_token" });
    await githubRequest("/user", stored.token);

    if (action === "status") {
      return responseWithLogging({
        connected: true,
        status: "connected",
        last_verified_at: verifiedAt,
        last_sync_at: stored.lastSync ?? verifiedAt,
      });
    }

    const repos = await githubRequest<Array<{ owner?: { login?: string }; name?: string; pushed_at?: string | null }>>(
      "/user/repos?sort=updated&per_page=10",
      stored.token,
    );

    let openPrs = 0;
    let blockedPrs = 0;
    let stalePrs = 0;
    const signals: Array<Record<string, unknown>> = [];
    let partialFailure = false;

    for (const repo of repos.slice(0, 5)) {
      const owner = repo.owner?.login;
      const name = repo.name;
      if (!owner || !name) continue;

      try {
        const pulls = await githubRequest<Array<{ title?: string; draft?: boolean; updated_at?: string | null }>>(
          `/repos/${owner}/${name}/pulls?state=open&per_page=20`,
          stored.token,
        );
        openPrs += pulls.length;

        for (const pr of pulls) {
          const updatedAt = Date.parse(pr.updated_at || "");
          const isStale = Number.isFinite(updatedAt) && updatedAt < Date.now() - 7 * 24 * 60 * 60 * 1000;
          if (pr.draft) blockedPrs += 1;
          if (isStale) stalePrs += 1;
          if ((pr.draft || isStale) && signals.length < 6) {
            signals.push({
              type: pr.draft ? "blocked_pr" : "stale_pr",
              repo: `${owner}/${name}`,
              label: pr.title || "Untitled PR",
            });
          }
        }
      } catch (error) {
        partialFailure = true;
        logGithub("repo scan failure", {
          repo: `${owner}/${name}`,
          message: error instanceof Error ? error.message : String(error),
        });
        if (signals.length < 6) {
          signals.push({
            type: "repo_scan_failed",
            repo: `${owner}/${name}`,
            label: error instanceof Error ? error.message : "GitHub repo scan failed",
          });
        }
      }
    }

    const releaseRisks = blockedPrs + stalePrs;
    const reposScanned = Math.min(repos.length, 5);
    const summary = reposScanned === 0
      ? "GitHub connected but no repositories were available to scan."
      : `${openPrs} open PRs, ${blockedPrs} blocked drafts, and ${stalePrs} stale PRs across ${reposScanned} repositories.`;

    return responseWithLogging({
      connected: true,
      status: partialFailure ? "degraded" : "connected",
      last_verified_at: verifiedAt,
      last_sync_at: stored.lastSync ?? verifiedAt,
      error_code: partialFailure ? "repo_scan_partial_failure" : null,
      error_message: partialFailure ? "Some repositories could not be scanned fully" : null,
      repos_scanned: reposScanned,
      open_prs: openPrs,
      blocked_prs: blockedPrs,
      stale_prs: stalePrs,
      release_risks: releaseRisks,
      signals,
      summary,
      metrics_summary: summary,
    });
  } catch (error) {
    const classification = classifyError(error);
    logGithub("verification failure", {
      error_code: classification.error_code,
      message: error instanceof Error ? error.message : String(error),
    });
    return responseWithLogging({
      status: classification.status,
      connected: false,
      last_verified_at: stored.lastSync ?? new Date().toISOString(),
      last_sync_at: stored.lastSync ?? new Date().toISOString(),
      error_code: classification.error_code === "upstream_auth_failed" ? "user_verification_failed" : classification.error_code,
      error_message: error instanceof Error ? error.message : "GitHub verification failed",
    });
  }
});
