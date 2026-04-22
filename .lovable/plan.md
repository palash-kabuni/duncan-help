

## Goal
Make Slack a real input to the daily Team Briefing — read the last 24h of channel conversations, run the same kind of structured signal extraction we run on email, and feed the result into the briefing payload. Today Slack is only used for outbound notifications; the briefing prompt itself even labels Slack inbound as "NOT scanned."

## What's in place today

- **Slack connector**: bot connection already linked, with `channels:history`, `channels:read`, `groups:history`, `mpim:history`, `im:read` scopes — sufficient to read public channels the bot is in, plus private channels/DMs where it's been invited.
- **Email pulse**: `ceo-email-pulse` Edge Function pulls 24h of inbox/sent per opted-in mailbox, runs `gpt-4o-mini` extraction, returns structured `signals` (commitments, risks, escalations, board mentions, customer issues, vendor signals) and `leadership_status`. The briefing function calls it, writes results into `payload.email_pulse`, and feeds `email_pulse_signals` to the LLM.
- **Briefing**: `ceo-briefing` already lists `slack_inbound` in `sources_unavailable` and explicitly tells the prompt Slack inbound isn't scanned.
- **Friction Section 03**: requires ≥2 non-email systems for evidence. A real Slack reader will count as one of those non-email systems and unlock genuine cross-system friction items (e.g., Slack escalation + stuck card, Slack confusion + Azure slip).

## What we'll build

### 1. New Edge Function: `ceo-slack-pulse`
Mirrors `ceo-email-pulse` in shape and contract.

- **Discover channels**: `conversations.list` (`types=public_channel,private_channel`, `exclude_archived=true`, paginated). Skip channels the bot isn't a member of (Slack returns `not_in_channel` on history calls otherwise). Cap at 30 most-active channels by message count to keep latency bounded.
- **Pull last 24h of messages** per channel via `conversations.history` with `oldest = now - 86400`. Skip bot/system messages, join messages, and Duncan's own posts (filter by bot user ID).
- **Resolve user IDs** to display names via `users.info` (cached per run) so signals reference real people, not `U0ABC…`.
- **Extract signals** with one `gpt-4o-mini` call per channel (or batched, depending on size), using the same schema as email pulse plus Slack-specific fields:
  - `commitments` — promises with owner + due date hint
  - `escalations` — unresolved threads with repeated follow-ups (≥3 messages from ≥2 people without resolution)
  - `confusion` — threads showing ownership/decision ambiguity
  - `customer_issues` — customer names or product complaints surfaced
  - `silent_channels` — channels that were active in the prior 7 days but had 0 human messages in the last 24h
- **Return**: `{ channels_scanned, channels_eligible, per_channel: [...], signals: {...}, generated_at }`.

### 2. Wire it into `ceo-briefing/index.ts`
- Add a `slack_pulse` fetch alongside the existing `email_pulse` block (~line 1202). Same try/catch pattern, same non-blocking failure mode.
- Add `slack_pulse_signals` to the LLM payload alongside `email_pulse_signals`.
- Update the friction prompt rule (line 199) so Slack escalations/confusion count as a **non-email system** — meaning a friction item can now legitimately combine "Slack escalation in #product + Azure work item slipping" without violating the ≥2-non-email-systems rule.
- Update the "all zero" empty-state guard (~line 2089) to include Slack signal counts so the briefing reports honestly when both Slack and email returned nothing.
- Remove the `slack_inbound` entry from `sources_unavailable` and the "Slack inbound NOT scanned" provenance line (~line 2188); replace with a real "Slack: scanned N channels, X messages, Y signals extracted" provenance note.

### 3. Coverage card
- `DataCoverageCard` / coverage_summary already enumerates email mailboxes. Add a parallel `slack_channels` row showing channels scanned vs total, mirroring the mailbox treatment so the CEO can see Slack coverage at a glance.

### 4. UI: surface Slack signals in the existing pulse area
- Currently the "Email Pulse" card shows email-derived signals.
- Rename the section to **Comms Pulse** and show two grouped columns: **Email** (existing) and **Slack** (new). Same metric chips: commitments, risks raised, escalations, customer issues. Tooltips already in place from prior change.
- Empty state per column when nothing returned.

## Files touched
- New: `supabase/functions/ceo-slack-pulse/index.ts` — channel discovery, history pull, user resolution, LLM extraction.
- Edit: `supabase/functions/ceo-briefing/index.ts` — invoke slack-pulse, pass into LLM payload, update friction rule + provenance + empty-state guard, drop `slack_inbound` from `sources_unavailable`.
- Edit: `src/components/ceo/EmailPulseCard.tsx` (rename to `CommsPulseCard.tsx`) — two-column Email/Slack layout.
- Edit: `src/components/ceo/DataCoverageCard.tsx` — add Slack channels row.
- Edit: `src/pages/CEOBriefing.tsx` — import the renamed component, pass `slack_pulse` data.

## Guardrails
- **Read-only**: no posting, no reactions, no DMs sent. Bot only listens.
- **Privacy**: raw Slack messages are sent to OpenAI for one-time extraction only (same pattern as email pulse) — nothing stored except the structured JSON signals.
- **Bounded cost**: cap at 30 channels × 200 messages each per run; one `gpt-4o-mini` call per channel batch.
- **Failure isolation**: if Slack pulse fails, the rest of the briefing still generates (same try/catch as email pulse).
- **Bot membership**: only channels the bot is a member of are scanned. The plan does NOT auto-join channels — surfacing channels the bot isn't in as "not scanned" in the coverage card lets the team explicitly invite Duncan where they want it listening.

## Out of scope
- HubSpot integration (separate connector, not yet wired).
- DM scanning by default (the bot doesn't have access to user DMs unless directly messaged; we'll only read DMs sent *to* the bot, which is essentially zero today).
- Slack search API (requires user-token, not bot-token; not needed for a 24h windowed scan).
- Auto-inviting the bot to channels.

