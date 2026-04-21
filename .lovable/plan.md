

## Goal
Add a **Lovable Contributors leaderboard** to Section 07 (Duncan Adoption & Automation) on the Team Briefing, ranking Kabuni members by commits and lines changed in `kabuni/duncan` over the last 30 days.

## Approach
GitHub commits are the only honest proxy for "who shipped what via Lovable" — Lovable does not expose per-user credit/token data. Lovable-originated commits land under a single bot author; direct IDE commits land under each developer's GitHub email. Both are surfaced.

## Changes

### 1. Connect GitHub + add secret
- Direct user to **Connectors → GitHub → Connect** to link the Duncan repo (`kabuni/duncan`).
- Add a runtime secret `GITHUB_TOKEN` (PAT with `repo:read` scope) for REST API auth, since GitHub is not in the gateway connector list. Repo path is hardcoded to `kabuni/duncan` (no env vars needed — single known repo).

### 2. Server: `gatherGithubContributors()` in `supabase/functions/ceo-briefing/index.ts`
Run in parallel with existing `automation_leverage` gather. For the last 30 days:

- `GET /repos/kabuni/duncan/commits?since=<iso>&per_page=100` — paginate up to 5 pages (cap 500 commits).
- Aggregate per author email: `commits` count.
- For top 10 authors by commit count, fetch detail commits (`GET /commits/{sha}`) — capped at 50 detail calls total — to sum `additions` + `deletions`. Remaining authors show commits only with `lines_changed: null`.
- Map `commit.author.email` → Kabuni profile via case-insensitive match against `auth.users.email` (joined through `profiles.user_id`). Unmapped → fallback to GitHub `login` with `is_kabuni: false`.
- Collapse all non-Kabuni authors (bots, externals) into one `"Other contributors"` row.
- Return `{ contributors, window_days: 30, total_commits, fetched_at }`.

After LLM parse, write to `parsed.payload.github_activity`. Wrap in try/catch — failure logs `briefing_warnings.push("github_activity_failed: …")` and skips the block. If `GITHUB_TOKEN` missing, return `{ unavailable: true, reason: "not_connected" }`.

### 3. Frontend: leaderboard card in `src/pages/CEOBriefing.tsx`
Insert below "Top 3 power users" in Section 07:

```
LOVABLE CONTRIBUTORS · last 30d
────────────────────────────────────────
{total_commits} commits · {N} contributors

Name                  Commits   +/- lines
────────────────────────────────────────
Nimesh Patel             42     +3,210 / −812
Palash Soundarkar        18     +1,540 / −204
Lovable bot              97     +8,420 / −2,103
…
Other contributors        9          —
```

- Styling matches existing cards: `rounded-lg border border-border bg-card p-4`, `font-mono tabular-nums` for numbers.
- Kabuni rows highlighted with subtle accent; bot/external rows muted.
- Empty/unavailable state: muted message *"GitHub not connected — link kabuni/duncan via Connectors → GitHub and add a `GITHUB_TOKEN` secret to enable this leaderboard."*

### 4. Caching
None needed — one briefing run uses ~10–20 GitHub API calls, well under the 5,000/hr authenticated limit.

## Out of scope
- Lovable per-user credit/token consumption (no API exists).
- Splitting Lovable-bot commits back to the prompting user (Lovable doesn't tag this).
- Per-PR or per-file breakdowns.

## Files touched
- `supabase/functions/ceo-briefing/index.ts` — add `gatherGithubContributors()`, post-parse overwrite.
- `src/pages/CEOBriefing.tsx` — new leaderboard card in Section 07.

## Required from you before implementation
1. Link GitHub via **Connectors → GitHub** to `kabuni/duncan`.
2. Approve the `GITHUB_TOKEN` secret request (PAT with `repo:read`).

