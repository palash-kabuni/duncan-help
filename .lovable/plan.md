

## Goal
Extend Duncan's Gmail capability from read-only to: read full threads, draft replies (saved to Gmail Drafts, never auto-sent), and learn the user's writing style from sent mail so drafts sound like them.

## Current State
- `gmail-api` Edge Function supports: `status`, `list`, `search`, `read`, `send`, `disconnect` — no draft, no thread, no reply.
- `norman-chat` exposes `send_gmail_email` with strict composition rules, but no draft or reply tools.
- OAuth scopes today: `gmail.readonly` + `gmail.send`. Drafts need additional scopes.
- No storage for user writing-style data.

## What's Needed

### 1. Expand Gmail OAuth scopes
Add `gmail.compose` (covers drafts) and `gmail.modify` (mark read, label). Existing users reconnect once — surface a "Reconnect Gmail" banner when scope check fails.

### 2. New `gmail-api` actions
In `supabase/functions/gmail-api/index.ts`:
- `read_thread` — full thread for reply context.
- `create_draft` — `gmail.users.drafts.create` with `In-Reply-To`, `References`, `threadId` so it threads correctly.
- `list_drafts`, `update_draft` — for iteration.
- `learn_from_sent` — pull last ~100 messages from `SENT` for style analysis.

### 3. New Duncan tools in `norman-chat`
- `read_gmail_thread(threadId)` — fetch conversation before drafting.
- `draft_gmail_reply({ threadId, messageId, body, cc?, bcc? })` — composes, saves to Drafts. **Never sends.** Returns Gmail draft URL.
- `draft_gmail_email({ to, subject, body, cc?, bcc? })` — new draft, not a reply.
- Existing `send_gmail_email` stays, gated by explicit confirmation.

### 4. Writing-style learning (key new capability)

**Approach: profile-based, no fine-tuning** (fits Lovable Cloud).

New table `gmail_writing_profiles`:
| column | type |
|---|---|
| user_id | uuid (FK profiles, unique) |
| style_summary | text (200–400 word natural-language profile) |
| common_phrases | jsonb (openers, closers, transitions) |
| sample_replies | jsonb (5–10 redacted exemplars) |
| tone_metrics | jsonb (sentence length, formality 1–5, emoji use, etc.) |
| last_trained_at | timestamptz |
| sample_count | int |

RLS: user can only read/write their own row.

New Edge Function `gmail-train-style`:
1. Calls `gmail-api` `learn_from_sent` for ~100 recent sent messages.
2. Strips quoted replies (`> `, `On … wrote:`) and signatures.
3. Redacts PII (emails, phone numbers, recipient names in salutations) before sending samples to LLM.
4. Sends to GPT-4o: "Analyse how this person writes — tone, openers/closers, sentence rhythm, formality, emoji habits, sign-offs. Output JSON matching the schema."
5. Stores result.

**Injection into drafting:** when `draft_gmail_reply` / `draft_gmail_email` runs, `norman-chat` loads `style_summary` + `common_phrases` and prepends to the existing email composition rules:

```text
USER WRITING STYLE (mimic this):
{style_summary}

Common phrases this user uses:
{common_phrases}

Override the generic email rules ONLY where they conflict with the user's natural style.
```

### 5. UI
- **Reader view**: "Draft reply with Duncan" button → toast "Draft saved to Gmail" with link to open it.
- **Settings → Gmail** (new panel): "Train Duncan on my writing style" button, last-trained timestamp, sample count, "Re-train" + "Delete profile" actions.
- **Reconnect banner** on `/gmail` if scope check fails.

### 6. Privacy & safety
- Sent mail isn't stored beyond derived `style_summary` + redacted snippets.
- PII redaction before LLM call.
- Drafts never auto-sent; existing confirmation gate on `send_gmail_email` preserved.
- One-click delete profile in settings.

## Files to Change/Create

**Edge Functions**
- `supabase/functions/gmail-auth/index.ts` — add new scopes
- `supabase/functions/gmail-api/index.ts` — add `read_thread`, `create_draft`, `list_drafts`, `update_draft`, `learn_from_sent`
- `supabase/functions/gmail-train-style/index.ts` — new
- `supabase/functions/norman-chat/index.ts` — register new tools, inject writing profile

**Database migration**
- Create `gmail_writing_profiles` + RLS

**Frontend**
- `src/hooks/useGmailIntegration.ts` — add `useGmailDraft`, `useGmailThread`, `useGmailTrainStyle`, `useGmailWritingProfile`
- `src/components/gmail/GmailReader.tsx` — add "Draft reply with Duncan" button
- `src/components/settings/SettingsGmail.tsx` — new training UI
- `src/pages/Gmail.tsx` — reconnect banner if scopes missing

## Open Questions for You

1. **Send behaviour** — keep `send_gmail_email` (drafts default, send on explicit confirm), or drafts only and remove send entirely?
2. **Style training trigger** — manual only, manual + weekly auto-refresh, or auto on first connect?
3. **Training scope** — last 100 sent (~30s, cheap), last 300 (~2min, richer), or user-selectable?
4. **Reply context** — full thread always, last 5 messages, or just the message being replied to?

