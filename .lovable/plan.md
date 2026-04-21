

## Goal
Add a **GitHub commit activity** block to Section 07 (Duncan Adoption & Automation) showing how much code each Kabuni team member has shipped to the Duncan repo over the last 30 days.

## Why this proxy
Lovable.dev does not expose a public API for per-user credit or token usage on a project. The closest honest signal is **commits authored on the connected GitHub repo** — every Lovable change is auto-committed, and direct IDE/local commits also flow through. So "code shipped" = commits + lines changed per author.

## Changes

### 1. Connect GitHub
Add the GitHub connector to the project (gateway-enabled, OAuth). Once linked, `LOVABLE_API_KEY` + `GITHUB_API_KEY` are available to edge functions. User picks the Duncan repo during connect.

### 2. Store repo identity
Add two env-driven constants in `ceo-briefing/index.ts`:
- `GITHUB_REPO_OWNER` (e.g. `kabuni`)
- `GITHUB_REPO_NAME` (e.g. `duncan`)

Read from `Deno.env`. If not set, the new block is silently skipped (no failure).

### 3. New server-side helper: `gatherGithubContributors()`
Runs in parallel with the existing `automation_leverage` gather step. For the last 30 days:

- Call `GET /repos/{owner}/{repo}/commits?since=...&per_page=100` (paginated, cap 5 pages = 500 commits).
- For each unique author email/login, aggregate:
  - `commits` (count)
  - `additions` + `deletions` (sum, fetched lazily via `GET /repos/{owner}/{repo}/commits/{sha}` for the top N authors only, to avoid 500 extra API calls)
- Map GitHub login → Kabuni profile by matching `commit.author.email` against `profiles.user_id` → auth.users.email (case-insensitive). Unmapped authors fall back to their GitHub login + a `(external)` tag.
- Return `{ contributors: [{ name, github_login, email, commits, additions, deletions, lines_changed, is_kabuni }], window_days: 30, total_commits, fetched_at }`.

Cap and sort: keep all Kabuni contributors with ≥1 commit, sort descending by `lines_changed`. External authors (bots, non-Kabuni) collapsed into a single `"Other contributors"` row.

### 4. Persist into briefing payload
After the LLM parse, write the result to `parsed.payload.github_activity` (alongside the existing `automation_progress` overwrite at line ~3309). LLM is **not** asked to author this — purely server-computed, like `top_users`.

### 5. Frontend block in Section 07
Below the existing "Top 3 power users" block in `src/pages/CEOBriefing.tsx`, add a new card:

```
GITHUB CONTRIBUTIONS · last 30d
─────────────────────────────────
{total_commits} commits across {N} contributors

Name                Commits   +/- lines
─────────────────────────────────
Nimesh Patel        42        +3,210 / -812
Palash Soundarkar   18        +1,540 / -204
…
Other contributors  9         +610 / -120
```

Match existing card styling (`rounded-lg border border-border bg-card p-4`, mono labels, tabular-nums). Show empty state if `github_activity` missing or `contributors.length === 0`: muted "GitHub repo not connected — connect via Connectors → GitHub to see contribution stats."

### 6. Caching / cost
GitHub API allows 5,000 req/hr authenticated — well within budget (one briefing run = ~10-20 calls). No caching layer needed. Failure is non-fatal: wrap the helper in try/catch and log `briefing_warnings.push("github_activity_failed: ...")`.

## Out of scope
- Lovable per-user credit/token consumption — no API exists.
- Linking GitHub commits to specific Lovable sessions (Lovable's commit author is a single bot account, not the prompting user).
- Per-PR, per-branch, or per-file breakdowns.
- A separate "code shipped via Lovable vs IDE" split.

## Open question
The GitHub connector needs to be linked before this works. After approval, the first step in implementation will prompt you to authorize the GitHub connector and pick the Duncan repo. Confirm now if the repo is `kabuni/duncan` or a different `owner/name` so the env defaults can be set correctly.

