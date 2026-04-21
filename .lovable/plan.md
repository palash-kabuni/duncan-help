

## Issue
The "25% Automation" headline on the Team Briefing isn't a measurement — it's the **2026 target** being misrepresented as current state.

## Root cause
Two compounding problems in `supabase/functions/ceo-briefing/index.ts`:

1. **Deterministic fallback is misleading** (line ~1903). When the LLM truncates and the server falls back, it computes:
   ```
   percent = min(25, round(active_users / 8 * 25))
   ```
   With 13 active users today, this caps at **25** — i.e. the fallback always emits the target itself as the "current %". There is no actual measurement of automated-vs-manual work.

2. **The LLM has no grounded number to use either.** The prompt repeatedly states "Duncan automates 25% of the company" as the 2026 priority, then asks the LLM for `automation.percent` with zero source data on what's actually automated. So when the LLM does answer, it anchors to 25% by suggestion. The UI then renders it next to a `target 25%` badge — making "current = target", which reads as "we're done".

Today's stored row confirms this: `automation.percent = 25`, `blockers = "Model output truncation required deterministic fallback generation"`. It's the fallback firing.

## What I'll change

### 1. Fix the deterministic fallback (server)
Replace the fake formula with an honest signal we can actually compute from `automation_leverage`:
- Compute an **adoption proxy** (not "% of company automated"):
  `adoption_pct = round(active_users_30d / total_kabuni_headcount * 100)` — capped at 100, floor 0.
- Headcount = count of `profiles` with `@kabuni.com` and `approval_status = 'approved'` (already loaded server-side; if missing, fall back to a constant like 12).
- Set `automation.percent = adoption_pct` and rename what it represents in `working`/`next`/`blockers` strings to make clear this is **adoption**, not automation coverage.

### 2. Stop the LLM inventing a number
- Remove `percent` from the LLM-authored `automation` object in both schema hints (`MORNING_SCHEMA_HINT` and `minimalMorningSchemaHint`).
- Have the server **always** overwrite `parsed.payload.automation.percent` with the computed adoption_pct after parsing (same place `automation_progress` is already overwritten at line ~3183-3288). LLM keeps `working`/`manual`/`next`/`blockers` prose only.

### 3. Frontend label fix (`src/pages/CEOBriefing.tsx`, ~line 482-488)
The current UI shows a big number with a `target 25%` badge. Reframe to remove the false equivalence:
- Change label from implicit "Automation %" to **"Team adoption"** with subtext: *"X of Y Kabuni users active in Duncan over the last 30 days."*
- Remove the `target 25%` badge from this card (it conflated two different metrics).
- Add a **separate** small line: *"2026 target: Duncan automates 25% of company workflows — no measurement source yet."* So the target is still visible but plainly marked as unmeasured.

### 4. Section heading
Rename Section 7 from **"Automation Progress"** → **"Duncan Adoption & Automation"**, and add a one-line caption: *"Adoption is measured from usage logs. Automation % of company workflows is a 2026 goal — not yet instrumented."*

## Out of scope
- Building a real "% of company automated" metric. That requires defining what counts as an automated workflow (e.g. tracked by tool category in `token_usage` or a manual taxonomy) and is a separate piece of work. Flagging here so we don't silently regenerate a misleading number.

## Files touched
- `supabase/functions/ceo-briefing/index.ts` — fallback formula, schema hints, post-parse overwrite of `automation.percent`.
- `src/pages/CEOBriefing.tsx` — Section 7 heading, headline card copy, remove `target 25%` badge.

