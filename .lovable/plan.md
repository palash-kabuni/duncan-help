
## Goal
Fix the **“What Changed Yesterday”** section so it never renders as a blank block, and surface exactly which mailboxes are currently opted out of the daily briefing email scan.

## Current findings
- The latest saved briefing still has `payload.what_changed = []`.
- The current empty-state injection in `supabase/functions/ceo-briefing/index.ts` only runs when **all** tracked sources are zero:
  - workstream cards 24h = **1**
  - Azure 24h = **0**
  - meetings 24h = **0**
  - Slack notifications 24h = **0**
  - email pulse signals = **non-zero**
- Because that guard requires everything to be zero, the section stays blank even though the UI has no fallback for an empty `what_changed` array.

## Opted-out mailboxes right now
These 3 mailboxes are currently not included in the daily briefing email scan:
- `adit@kabuni.com`
- `duncan@kabuni.com`
- `parmy@kabuni.com`

## Fix
### 1. Make “What Changed Yesterday” always explain itself
In `supabase/functions/ceo-briefing/index.ts`:
- Replace the narrow `all_sources_empty_24h` guard with a broader fallback:
  - if `parsed.payload.what_changed` is empty after generation/post-processing, inject a deterministic explanation row.
- Make that row reflect the real source counts, for example:
  - cards: 1
  - Azure: 0
  - meetings: 0
  - Slack notifications: 0
  - email signals: non-zero
- The fallback copy should explain that Duncan saw signal in some systems but did not have enough structured movement to populate the section, instead of leaving the section visually empty.

### 2. Distinguish between “no activity” vs “activity exists but nothing summarised”
Use two deterministic fallback reasons:
- `all_sources_empty_24h` when every source is truly zero
- `what_changed_empty_despite_signals` when at least one source has activity but no rows were produced

This keeps the section honest and debuggable.

### 3. Surface opted-out mailbox names in the email pulse payload
In `supabase/functions/ceo-email-pulse/index.ts`:
- Extend the response so it returns a lightweight `opted_out_mailboxes` array alongside the current counts.
- Populate it from the already computed `skipped` mailboxes.
- Keep it to mailbox address + display name only.

### 4. Show the opted-out mailboxes in the UI
In `src/components/ceo/EmailPulseCard.tsx`:
- Add a small expandable line under the mailbox summary:
  - “3 opted out”
  - expands to show `Adit`, `Duncan`, `Parmy` with email addresses
- This makes the count actionable instead of opaque.

### 5. Add a UI fallback as a second safety net
In `src/pages/CEOBriefing.tsx`:
- If `p.what_changed` is empty, render a bordered explanation card instead of a blank section.
- This protects the page even if an older briefing payload or future regression returns `[]`.

## Files touched
- `supabase/functions/ceo-briefing/index.ts`
- `supabase/functions/ceo-email-pulse/index.ts`
- `src/components/ceo/EmailPulseCard.tsx`
- `src/pages/CEOBriefing.tsx`

## Out of scope
- No schema changes
- No Slack channel reader yet
- No change to who is opted in/out; only visibility and reporting
