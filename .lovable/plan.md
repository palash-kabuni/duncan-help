

## Add company-wide email scanning to the CEO Briefing

### What you're asking for

Right now the CEO briefing reads meetings (Plaud + Google Meet) and workstreams, but **zero emails**. You want Duncan to scan inboxes across the leadership team plus any Duncan user with Gmail connected, so the briefing reflects what's actually being said in writing — commitments, escalations, board mentions, customer issues, vendor risk.

### What gets built

**1. New "Company Email Pulse" data source for `ceo-briefing`**

The function will iterate over every row in `gmail_tokens` (currently treated as a single shared inbox) and pull the **last 24h of mail** from each connected mailbox using each user's own OAuth tokens.

For each mailbox, fetch ~50 most recent inbox + sent messages and extract:
- Sender / recipient / subject / snippet / timestamp
- Thread participants (to detect cross-leadership conversations)
- Whether it's a reply, an external sender, or internal

**2. AI extraction layer (per-mailbox, parallel)**

Each batch of emails goes through a lightweight `gpt-4o-mini` pass that returns structured JSON only — no raw email content stored:

```text
{
  commitments:   [{ owner, what, due, source_email_id }]
  risks:         [{ severity, summary, who_flagged, priority_match }]
  escalations:   [{ from, to, topic, urgency }]
  board_mentions:[{ topic, sender }]
  customer_issues:[{ company, issue, severity }]
  vendor_signals:[{ vendor, signal, amount? }]
  silent_leaders:[{ leader, no_outbound_24h: true }]
}
```

Personal data (full body, attachments, non-work threads) is **never persisted** — only the structured signals above are.

**3. Feeding the briefing**

The structured email signals are merged into the existing context the briefing already builds:

- `commitments` → Decisions §9 (cross-checked against workstream owners)
- `risks` + `escalations` → Risk Radar (with new `source: "email"` tag and `probability_impact_pts`)
- `board_mentions` → TLDR + Investor section
- `customer_issues` / `vendor_signals` → Operations + Finance domains in Data Coverage
- `silent_leaders` → cross-checked against meeting silence; if a leader has no email AND no meeting in 7d, they get auto-flagged in Risk Radar

This means a partner email saying *"we need the India MoU signed by Friday"* will now appear in §9 even if no one logged a workstream card.

**4. Privacy & consent model**

- Only mailboxes already connected via the existing per-user Gmail OAuth flow are scanned. Nothing new to authorise for users who are already connected.
- A new toggle in **Settings → Gmail**: *"Allow Duncan to include signals from my inbox in the CEO briefing"* — defaults to **OFF** for everyone except the CEO (Nimesh) on first run, so leaders explicitly opt in.
- A new admin view at `/ceo` shows which mailboxes contributed to the briefing (count of emails scanned, signals extracted) so consent is auditable.
- Raw email bodies are sent to OpenAI for one-time extraction only and are never written to Supabase. Only the JSON output is stored on `ceo_briefings.payload.email_pulse`.

**5. UI surface**

New compact card on `/ceo` between **Company Pulse** and **Data Coverage**:

```text
Company Email Pulse — last 24h
  Mailboxes scanned: 7 of 9 leaders (2 not connected)
  Emails analysed:   428
  New commitments:   12  (3 unowned — see §9)
  Risks raised:      4   (1 critical — fed into Risk Radar)
  Silent leaders:    Patrick (0 outbound), Simon (0 outbound)
  [View full breakdown]
```

The "silent leaders" line is the part you specifically asked for — *total clarity* on who is actually communicating vs who's gone dark.

### Files to change

```text
NEW    supabase/functions/ceo-email-pulse/index.ts
         - Iterates gmail_tokens, refreshes per-user, fetches 24h messages,
           runs gpt-4o-mini extraction, returns structured signals
         - Called by ceo-briefing in parallel with existing data fetches

EDIT   supabase/functions/ceo-briefing/index.ts
         - Invoke ceo-email-pulse, merge signals into:
             • commitments → §9 Decisions
             • risks → Risk Radar (with probability_impact_pts)
             • silent_leaders → cross-ref with meeting silence
             • board_mentions → TLDR + Investor section
         - Persist email_pulse summary on payload (counts only, no content)

EDIT   src/components/settings/SettingsGmail.tsx
         - Add "Include my inbox in CEO briefing" toggle
         - Persist on gmail_writing_profiles (new column ceo_briefing_optin)

NEW    src/components/ceo/EmailPulseCard.tsx
         - Renders mailboxes scanned, signals extracted, silent leaders

EDIT   src/pages/CEOBriefing.tsx
         - Mount <EmailPulseCard /> between CompanyPulse and DataCoverage
         - Pass payload.email_pulse through

DB MIGRATION
         - ALTER TABLE gmail_writing_profiles
             ADD COLUMN ceo_briefing_optin boolean NOT NULL DEFAULT false;
```

### Out of scope (ask if you want)

- Scanning Slack DMs the same way (different OAuth flow, separate plan)
- Pulling Outlook/M365 mailboxes for non-Google users
- Auto-creating workstream cards from unowned commitments found in email

