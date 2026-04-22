

## What's actually broken

Three concrete bugs are making your Team Briefing look empty:

### 1. Email pulse silently returns nothing (the big one)
`ceo-email-pulse` ran for every opted-in mailbox, but **every single mailbox failed JSON parsing**. Logs show repeated:
```
extractSignals error: SyntaxError: Unexpected token '`', "```json …
```
Claude is wrapping its JSON in ```` ```json ... ``` ```` fences and `JSON.parse` chokes. The function then returns empty arrays for commitments / risks / escalations / board mentions — so the briefing thinks "no email activity exists" even though 7 mailboxes were scanned. Confirmed in DB: latest 3 briefings have `email_pulse_signals = null` / 0 commitments.

### 2. "What's moved in the last 24h" is genuinely empty — because the data window is empty
Hard counts from the DB right now:
- `workstream_cards` updated in 24h → **1**
- `azure_work_items` changed in 24h → **0**
- `meetings` in 24h → **0**
- `slack_notification_logs` in 24h → **0**

So `payload.what_changed` = `[]` is technically correct, but the briefing presents it as "nothing happened" instead of "no signal in the tracked sources". The model also currently silently emits `[]` when sources are thin, with no honest empty-state copy.

### 3. Slack is read-only and shallow
Slack is **not actively checked** — the briefing only reads `slack_notification_logs` (Duncan's own outbound DMs about overdue cards). It does not call the Slack API to read channel messages, mentions, or DMs. So when you ask "is it checking across Slack" — no, it's only looking at what Duncan itself sent.

---

## Fix

### A. `supabase/functions/ceo-email-pulse/index.ts`
Strip code-fence wrappers before `JSON.parse` in `extractSignals`. One helper:
```ts
const stripFences = (s: string) =>
  s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/,"").trim();
const parsed = JSON.parse(stripFences(raw));
```
Also wrap in a second-chance regex extractor (`/\{[\s\S]*\}/`) and log the first 200 chars of `raw` on failure so we can see what came back. Add a `response_format: { type: "json_object" }` reminder in the system prompt ("Return ONLY a JSON object. No markdown, no fences, no prose.").

### B. `supabase/functions/ceo-briefing/index.ts` — honest empty state
In the deterministic post-processing (where `what_changed` is finalised), if all four 24h counters (cards, Azure, meetings, slack notifications) are zero AND `email_pulse_signals` is null, inject one row:
```
{ function_area: "Operations & Delivery",
  moved: "No tracked activity in the last 24h.",
  did_not_move: "Cards / Azure / meetings / Slack / email pulse all returned 0 signals.",
  needs_attention: "Verify Plaud, Azure DevOps sync, and email pulse are running." }
```
So the section never renders blank — it tells you *why* it's blank.

### C. Surface Slack scope honestly
In Section 04 / data-coverage footer, add a one-line provenance note: "Slack: Duncan's own outbound notifications only. Inbound channel messages are not scanned." (No new integration — just stop implying we read Slack.)

### D. (Optional, ask before doing) Real Slack scan
If you want the briefing to actually read Slack channels for the last 24h (mentions of leaders, channels going silent, etc.), that's a new edge function `ceo-slack-pulse` using the existing `SLACK_API_KEY` connector — `conversations.history` over the leadership DMs + key public channels, then a second LLM extraction pass like email pulse. Out of scope for this fix unless you confirm.

---

## Files touched
- Edit: `supabase/functions/ceo-email-pulse/index.ts` — fenced-JSON tolerance + better logging.
- Edit: `supabase/functions/ceo-briefing/index.ts` — honest empty-state row in `what_changed`; Slack provenance note in coverage.

## Out of scope
- New Slack reader (D above) — needs your go-ahead.
- Backfilling missing meetings (Plaud sync gap) — separate diagnosis.

