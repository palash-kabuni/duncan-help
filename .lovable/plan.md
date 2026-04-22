

## Why Slack isn't being scanned in the team briefing

I traced the full path. Here's what's actually happening:

### Evidence

- **Latest briefing row (22 Apr)**: `slack_pulse = null`, `slack_pulse_error = "HTTP 500"`, provenance line says *"Slack inbound pulse did not run on this briefing — error: HTTP 500."*
- **`ceo-slack-pulse` edge function logs**: completely empty. The function is either not deployed, or crashing before it can log.
- **Slack connector**: linked, credentials verified (`{"outcome":"verified"}`), bot token active.
- **Slack scopes (configured / actually granted to the bot)**: `channels:history, channels:read, chat:write, chat:write.customize, groups:history, im:read, im:write, mpim:history, mpim:read, mpim:write, mpim:write.topic`.

### Root cause

`ceo-slack-pulse/index.ts` line 80 asks Slack for **both public AND private channels** in one go:

```
types: "public_channel,private_channel"
```

But the bot does **not** have `groups:read` configured. Slack rejects `conversations.list` with `missing_scope` the moment `private_channel` is in the request, the function throws, returns 500, and the briefing records "Slack pulse did not run."

So the briefing's "no Slack signal" message isn't a UI thing — Slack is **genuinely never being scanned**. The 4-pass friction reasoning has been running blind on Slack for every briefing since this code shipped.

A second contributor: even after the listing succeeds, the function only ever scans channels where `is_member = true`. Today Duncan is in very few channels, so even a successful run would cover a tiny slice of the company.

## What we'll fix

### 1. Stop the 500 — list public channels only
Change `types` to `"public_channel"` in `listAllChannels`. With `channels:read` already configured, this works immediately. Private channels stay out of scope until someone explicitly grants `groups:read` (and that's a separate decision — private channel scanning is a privacy call, not a bug fix).

### 2. Make the failure mode honest going forward
In `ceo-slack-pulse`, if `conversations.list` throws with `missing_scope` or `not_in_channel`, return `ok: true` with `degraded: true` and a `degraded_reason` string instead of a 500. That way the briefing gets *something* (channel counts, the not-member list) and the friction prompt can still cite "Slack scanned with reduced coverage" rather than going dark.

### 3. Surface "Duncan is not in this channel" as the actionable gap
The function already returns `not_member_channels`. Wire that count into the briefing's Comms Pulse / Data Coverage card so you can see at a glance:
- Channels total: e.g. 42
- Duncan is a member of: e.g. 6
- Channels scanned: 6
- Not invited (actionable): 36

Right now those numbers aren't shown anywhere visible — that's why "Slack" feels like a black box.

### 4. Re-deploy and verify
Deploy `ceo-slack-pulse`, then trigger one briefing and confirm:
- `payload.slack_pulse.ok = true`
- `channels_scanned > 0`
- `messages_analysed > 0` (assuming there's been any human chatter in the last 24h in channels Duncan is in)
- `friction_meta.slack_pulse_error = null`

### 5. Then — and only then — decide on coverage expansion
Once Slack is actually scanning, you'll have real data on what's being missed. At that point you can decide:
- Have Palash invite Duncan to the channels you care about (#leadership, #ops, #product, #india-launch, etc.), OR
- Add `groups:read` + `groups:history` to the connector to scan private channels too (requires explicit scope reconnection — I won't do this without asking).

## Files touched
- `supabase/functions/ceo-slack-pulse/index.ts`
  - Drop `private_channel` from the `conversations.list` types parameter.
  - Catch `missing_scope` / permission errors and return `{ ok: true, degraded: true, degraded_reason }` instead of a 500.
- `supabase/functions/ceo-briefing/index.ts`
  - When `slack_pulse.degraded === true`, write a clearer provenance line ("Slack scanned with reduced scopes — public channels only").
- `src/components/ceo/CommsPulseCard.tsx`
  - Show "Duncan in N of M channels — K not invited" so the gap is visible.
- Re-deploy `ceo-slack-pulse` and `ceo-briefing`.

## Out of scope (raise separately if wanted)
- Granting `groups:read` to scan private channels — needs your explicit OK.
- Auto-inviting Duncan to channels — Slack doesn't allow this; humans must invite the bot.
- HubSpot / other comms sources — still not wired.

