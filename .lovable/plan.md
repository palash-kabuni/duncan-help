

## Goal
Show a **Lovable Contributors** leaderboard in Section 07 of the Team Briefing. You drop the Lovable People-page screenshot directly into the chat (no upload UI in the briefing); Duncan parses it with vision and stores the rows.

## How it works
1. In any chat, you paste/attach the Lovable People screenshot and say something like *"refresh Lovable contributors"*.
2. Duncan recognises this via a new tool `update_lovable_contributors` in `norman-chat`.
3. The tool sends the attached image to the vision LLM (Claude Sonnet 4.5 via the shared router) with a strict JSON schema → rows of `{name, role, period_credits, total_credits, credit_limit}`.
4. Rows are written to a new `lovable_usage_snapshots` table, dated today.
5. Section 07 renders the most recent snapshot as a ranked leaderboard, captioned *"As of {date} · parsed from Lovable People page"*.
6. Re-running with a new screenshot creates a new dated snapshot; the card always shows the latest.

No upload button in the UI. No new bucket. Image flows through the existing chat multimodal path.

## Changes

### 1. New table `lovable_usage_snapshots`
```
id              uuid pk
snapshot_date   date
member_name     text
role            text
period_credits  int
period_label    text         -- e.g. "Apr usage"
total_credits   int
credit_limit    int nullable
created_by      uuid → auth.users
created_at      timestamptz
```
RLS: any authenticated Kabuni user can `select`; only admins (`has_role(auth.uid(),'admin')`) can `insert/delete`.

### 2. New tool `update_lovable_contributors` in `supabase/functions/norman-chat/index.ts`
- Triggered when the user attaches an image and asks to refresh Lovable contributors (admin-only; non-admins get a polite refusal).
- Sends the attached image to the vision LLM with a strict JSON-row schema.
- Validates rows (drop any missing `name` or `period_credits`).
- Inserts rows into `lovable_usage_snapshots` with today's date.
- Replies with a short confirmation: *"Saved {N} contributors as of {date}."*

### 3. New component `src/components/ceo/LovableContributorsCard.tsx`
- Fetches the latest `snapshot_date` and its rows, sorted by `period_credits` desc.
- Renders a ranked table (mono, tabular-nums, matching Section 07): Rank · Name · Role · Period credits · Total credits.
- Caption: *"As of {snapshot_date} · parsed from Lovable People page in chat"*.
- Empty state: *"No Lovable usage snapshot yet. Paste the Lovable → Project settings → People screenshot in chat and ask Duncan to refresh."*
- Read-only — no edit/upload controls.

### 4. Mount in `src/pages/CEOBriefing.tsx`
Insert the card in Section 07, directly under "Top 3 power users". No changes to the `ceo-briefing` Edge Function — this data is independent of the LLM-generated payload.

## Out of scope
- GitHub commits leaderboard (deferred until PAT is supplied).
- Trend/sparkline across snapshots (data captured for it; UI later).
- Auto-mapping Lovable names to Kabuni `profiles` (kept as plain text).

## Files touched
- New migration: `lovable_usage_snapshots` + RLS policies.
- Edit: `supabase/functions/norman-chat/index.ts` — add `update_lovable_contributors` tool.
- New: `src/components/ceo/LovableContributorsCard.tsx`.
- Edit: `src/pages/CEOBriefing.tsx` — mount card in Section 07.

