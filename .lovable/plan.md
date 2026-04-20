
The user wants /whats-new to update automatically as features ship and bugs are fixed, rather than asking me each time.

Constraints from memory:
- Releases live in `releases` table, surfaced via `/whats-new`, managed via admin Release Manager (`mem://features/release-announcement-system`).
- Each release has version, title, summary, status (draft/published), changes JSONB array of `{type, description}`.
- Lovable Cloud + edge functions; OpenAI gpt-4o is the standard LLM.
- No GitHub commit hooks visible in current architecture (project syncs to GitHub but no CI/CD events flow back into the app).

Realistic options for automation — three viable approaches, each with different trade-offs:

**A. Conversational capture (lowest effort, highest signal)** — Add a Duncan tool `log_release_change` that lets me append a change to the current draft release whenever you describe a fix/feature in chat ("I just shipped X", "fix the bug Y"). Duncan auto-creates/maintains a single rolling draft release. You publish with one click (or one chat command) when ready.

**B. Scheduled AI digest (zero-touch, lower precision)** — A daily pg_cron job runs an edge function that scans recent activity (commits via GitHub API, edge function deploys, feedback_issues marked resolved) and asks gpt-4o to summarise into draft change entries appended to a rolling draft release. You review + publish weekly.

**C. Manual "publish current draft" button** — Just surface the rolling draft on /whats-new admin view with a one-click publish. Pairs well with A or B.

Recommended: **A + C**. B is appealing but GitHub commits are noisy and don't map cleanly to user-facing changes; the AI will hallucinate or include refactors. A keeps you in control of what counts as a release-worthy change while removing the "ask Duncan to update releases" friction entirely.

## Plan: Conversational release logging + one-click publish

### 1. New Duncan tool: `log_release_change`
Add to `supabase/functions/norman-chat/index.ts` tool registry. Parameters:
- `type`: feature | improvement | fix | other
- `description`: one-line user-facing change
- (optional) `version_bump`: patch | minor | major (defaults patch)

Behaviour:
- Find the latest `releases` row with `status='draft'`. If none, create one with auto-incremented version (bump from latest published; default `patch`).
- Append `{type, description}` to the `changes` JSONB array.
- Return confirmation including current draft version and total change count.

Admin-only (check via `has_role`).

### 2. Auto-trigger phrasing in Duncan's system prompt
Add instruction: "When the user says they shipped, fixed, improved, or released something user-facing, automatically call `log_release_change` to record it in the rolling draft release. Do not ask for confirmation — just log it and briefly mention it was added."

This means I capture changes as they happen in conversation without you asking.

### 3. One-click publish
On `/whats-new`, when viewing as admin, show a small "Current draft (N changes)" banner at top with a Publish button. Clicking it:
- Sets status to published, sets published_at to now()
- Auto-generates `title` and `summary` via gpt-4o from the accumulated `changes` if you haven't set them
- Then a fresh draft is started on the next `log_release_change` call

Also keep the existing Release Manager UI for manual editing.

### 4. (Optional, defer) Auto-publish weekly
A pg_cron job that publishes the current draft every Friday 5pm if it has ≥3 changes. Skip for v1 — start manual to build trust.

## Files to change
- `supabase/functions/norman-chat/index.ts` — register `log_release_change` tool, add prompt instruction
- `src/pages/WhatsNew.tsx` — admin draft banner + publish button (uses existing `usePublishRelease` and a new "auto-generate title/summary" edge function call)
- New edge function `supabase/functions/finalize-release/index.ts` — generates title + summary from changes array, then publishes
- DB: no schema changes needed (existing `releases` table already supports this)

## Verification
1. Tell Duncan in chat: "Just fixed a bug where Gmail drafts came out blank." → check `releases` table has a draft with that fix entry.
2. Tell Duncan: "Shipped auto-drafting Gmail replies." → same draft, second entry appended.
3. Visit /whats-new as admin → see "Current draft (2 changes) [Publish]" banner.
4. Click Publish → entry appears in published timeline with auto-generated title/summary.

## Trade-offs
- Relies on you mentioning changes in chat. If you ship something silently (direct DB tweak, edge function deploy without telling Duncan), it won't be captured. Acceptable — matches how you actually work today.
- Auto-generated title/summary may need editing before publish. The Release Manager edit flow already supports this.
- Version bumping is naive (always patch unless you say otherwise). Fine for now.
