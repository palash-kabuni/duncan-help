import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GITHUB_API = "https://api.github.com";

type GithubSummary = {
  ok: boolean;
  connected: boolean;
  status: "connected" | "not_configured" | "degraded";
  last_verified_at: string | null;
  degraded_reason: string | null;
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
    degraded_reason: null,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { action } = await req.json().catch(() => ({ action: "status" }));
  const stored = await getStoredToken();

  if (!stored?.token) {
    return json(baseResponse({ degraded_reason: stored && !stored.token ? "Stored GitHub token could not be decoded" : "GitHub token not configured" }));
  }

  try {
    const verifiedAt = new Date().toISOString();
    await githubRequest("/user", stored.token);

    if (action === "status") {
      return json(baseResponse({
        connected: true,
        status: "connected",
        last_verified_at: verifiedAt,
        degraded_reason: null,
      }));
    }

    const repos = await githubRequest<Array<{ owner?: { login?: string }; name?: string; pushed_at?: string | null }>>(
      "/user/repos?sort=updated&per_page=10",
      stored.token,
    );

    let openPrs = 0;
    let blockedPrs = 0;
    let stalePrs = 0;
    const signals: Array<Record<string, unknown>> = [];

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

    return json(baseResponse({
      connected: true,
      status: signals.some((s) => s.type === "repo_scan_failed") ? "degraded" : "connected",
      last_verified_at: verifiedAt,
      degraded_reason: signals.some((s) => s.type === "repo_scan_failed") ? "Some repositories could not be scanned fully" : null,
      repos_scanned: reposScanned,
      open_prs: openPrs,
      blocked_prs: blockedPrs,
      stale_prs: stalePrs,
      release_risks: releaseRisks,
      signals,
      summary: reposScanned === 0
        ? "GitHub connected but no repositories were available to scan."
        : `${openPrs} open PRs, ${blockedPrs} blocked drafts, and ${stalePrs} stale PRs across ${reposScanned} repositories.`,
    }));
  } catch (error) {
    return json(baseResponse({
      status: "degraded",
      connected: false,
      last_verified_at: stored.lastSync ?? new Date().toISOString(),
      degraded_reason: error instanceof Error ? error.message : "GitHub verification failed",
    }));
  }
});