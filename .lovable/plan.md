

## Goal
Make the **Accountability Watchlist (Section 05)** fully deterministic — rows AND owners computed server-side from `workstream_cards`, `workstream_card_assignees`, `azure_work_items`, and `priority_definitions`. The LLM no longer chooses watchlist content.

## Current state
The post-LLM injection block (lines 2240-2412 in `supabase/functions/ceo-briefing/index.ts`) already deterministically injects rows for: non-green workstreams, silent priorities, uncovered coverage domains, and silent leaders. But:
1. **Owner attribution** still leans on `ws.owner` (LLM-written) or falls back to `expected_owner`, not real assignees from cards / Azure work items.
2. **The LLM's own watchlist rows** are merged in first, so model-invented entries can still slip through.

## Fix
In `supabase/functions/ceo-briefing/index.ts`:

1. **Discard LLM watchlist entirely.** Replace `const wlIn = [...parsed.payload.watchlist]` with `const wlIn = []`. The model no longer contributes rows — it only provides `workstream_scores` (which are themselves grounded in cards + Azure).
2. **Compute owner deterministically per workstream.** Add a helper `resolveOwnerForWorkstream(name)` that:
   - Looks up the most recent non-archived `workstream_cards` row for that `project_tag` and resolves its `owner_id` via `team_directory.display_name`.
   - If no card owner, falls back to the most-frequent `azure_work_items.assigned_to` for the matching project.
   - If neither, falls back to `PRIORITY_DEFINITIONS.expected_owner`.
   - If still nothing, `"Unassigned — CEO to allocate"`.
3. **Use the resolver in all four injection branches** (a non-green workstreams, b silent priorities, c uncovered domains, d silent leaders) instead of `ws?.owner` / `expected_owner` first-pass.
4. **Tag every row with provenance.** Add `owner_source: "card_assignee" | "azure_assignee" | "priority_definition" | "unassigned"` so the UI/debug can show where the name came from.
5. **Update the prompt** (lines ~111, ~181-191, ~269): remove the watchlist schema entry from the model output spec and add `- Do NOT emit watchlist — the server computes it deterministically from cards + Azure + priorities.` to the existing "Do NOT emit" list at line 1786.

## Files touched
- Edit: `supabase/functions/ceo-briefing/index.ts` — add `resolveOwnerForWorkstream` helper, gut the LLM watchlist input, wire the resolver into the four injection branches, add `owner_source`, strip `watchlist` from the LLM output spec.

## Out of scope
- No UI changes to `src/components/ceo/` (existing watchlist renderer already handles the same row shape; new `owner_source` field is ignored unless we surface it later).
- No schema changes.
- Workstream Scorecard prose (Goal/Exec/$/Deps) stays LLM-generated as today — only the Watchlist becomes deterministic.

