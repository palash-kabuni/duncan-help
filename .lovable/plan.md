

## Goal
Stop the Team Briefing Section 04 (Initiative Snapshot) from listing workstream tags that have **no cards** (`duncan`, `kabuni-helpdesk`, `kabuni-mvp`). Only show workstreams that actually have activity.

## Root cause
`supabase/functions/ceo-briefing/index.ts` builds `available_workstreams` from a `DISTINCT project_tag` query on `workstream_cards`. Any tag that ever existed (even on archived/deleted cards) flows into the briefing. The post-LLM overwrite block then forcibly stamps each one with `"0 cards · silent"` so they appear as empty rows.

## Fix
In `supabase/functions/ceo-briefing/index.ts`:

1. **Filter the workstream list at source.** When building `workstream_baseline`, drop any tag where `card_count === 0`. Pass only active workstreams into the LLM prompt and into `available_workstreams`.
2. **Filter the overwrite block.** In the server-side overwrite (~lines 1983-2009), skip any workstream that isn't in the active set, so the LLM can't reintroduce silent rows.
3. **Empty-state copy.** If zero active workstreams remain, render Section 04 with a single line: *"No active workstreams in the last 7 days."* instead of an empty table.

No schema changes. No UI changes. No effect on the Workstreams board itself — silent tags remain available there for future cards; they just stop polluting the briefing.

## Files touched
- Edit: `supabase/functions/ceo-briefing/index.ts` — filter `workstream_baseline` and the overwrite block to active workstreams only; add empty-state copy.

