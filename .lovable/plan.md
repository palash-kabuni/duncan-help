

## Goal
Let Duncan **proactively pre-draft replies** to incoming Gmail messages in the background, so when the user opens an email the draft is already waiting in Gmail Drafts. User can toggle this on/off from within Duncan.

## Approach

### 1. User-controlled toggle
Add `auto_draft_enabled` (boolean, default `false`) + `auto_draft_last_run_at` to the existing `gmail_writing_profiles` table. User opts in explicitly — never on by default (privacy/cost).

UI: new toggle in **Settings → Gmail** panel ("Auto-draft replies for new emails"). Disabled until writing-style training has run at least once (drafts would otherwise sound generic).

### 2. Background drafting job
New Edge Function `gmail-auto-draft` that:
1. Lists all users with `auto_draft_enabled = true`.
2. For each user, fetches unread INBOX messages received since `auto_draft_last_run_at` (cap 20 per run).
3. For each message: skips if it already has a draft in its thread, skips automated/no-reply/list senders, skips short notifications.
4. Calls the existing `draft_gmail_reply` logic — reads last 5 thread messages, generates reply using user's `style_summary`, saves to Drafts via `gmail-api.create_draft`.
5. Updates `auto_draft_last_run_at`.

Triggered every 10 minutes via `pg_cron` (same pattern as `check-overdue-tasks`).

### 3. Skip rules (avoid noise)
- Sender domain in deny-list: `noreply@`, `notifications@`, `mailer-daemon@`, calendar invites, marketing list-unsubscribe headers present.
- Message body < 30 words (likely notification).
- Thread already has any draft.
- Message already labelled by Duncan (`Duncan/Auto-Drafted` Gmail label) — added after each draft to prevent re-drafting on retries.

### 4. UI feedback
- Settings panel shows: toggle state, "Last auto-draft run X minutes ago", count of drafts created in last 24h.
- Each auto-drafted reply gets a one-line prefix in the draft body: `[Auto-drafted by Duncan — review before sending]` so user always knows which drafts are AI-generated.

## Files to Change/Create

**Database migration**
- Add `auto_draft_enabled bool default false`, `auto_draft_last_run_at timestamptz`, `auto_drafts_created_today int default 0` to `gmail_writing_profiles`
- Schedule pg_cron job calling `gmail-auto-draft` every 10 min

**Edge Functions**
- `supabase/functions/gmail-auto-draft/index.ts` — new background worker
- `supabase/functions/gmail-api/index.ts` — add `add_label` action and `list_thread_drafts` helper

**Frontend**
- `src/hooks/useGmailIntegration.ts` — add `useGmailAutoDraftToggle` mutation
- `src/components/settings/SettingsGmail.tsx` — add toggle, gated on trained profile, plus stats row

## Notes & Trade-offs
- **Cost**: each user with toggle on can generate ~10–20 GPT-4o drafts/hour during peak. Cap at 20 drafts/run + 100/day per user to bound spend.
- **Privacy**: no email content is stored — drafts go straight to Gmail; only `auto_drafts_created_today` counter persists.
- **Safety**: drafts only, never sends. Existing `send_gmail_email` confirmation gate untouched.
- **Reversible**: toggle off = job skips that user immediately. Existing drafts stay in Gmail (user can delete).

