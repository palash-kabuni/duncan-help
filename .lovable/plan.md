
Yes — that's exactly the issue, and the logs confirm it.

## What the logs show

`Auto-draft run complete: { users: 1, created: 0, skipped: 0, errors: 0 }`

`skipped: 0` is the giveaway. If Duncan were looking at messages and rejecting them (too short, automated sender, etc.), `skipped` would be > 0. Zero skipped means **Gmail returned zero messages to look at** — the search query itself is filtering everything out before any per-message logic runs.

## Why

In `supabase/functions/gmail-auto-draft/index.ts` the search query is:

```
is:unread in:inbox after:${sinceTs} -label:Duncan-Auto-Drafted
```

Where `sinceTs` = `auto_draft_last_run_at` (or 24h ago on first run). That timestamp gets bumped to "now" at the **end of every run**, even when nothing was drafted. So every 10-minute run only looks at mail that arrived in the last ~10 minutes. Older unread mail in your inbox is permanently outside the window.

It is not looking at old email. Only brand-new arrivals.

## Fix (same as the previous plan you approved but not yet implemented)

In `supabase/functions/gmail-auto-draft/index.ts`:

1. **Replace the moving `after:` window with a fixed 7-day rolling lookback**: `after:${Math.floor((Date.now() - 7*24*60*60*1000)/1000)}`. The Duncan label + daily cap already prevent re-drafting, so we don't need the timestamp gate.
2. **Stop using `auto_draft_last_run_at` for filtering** — keep updating it for observability only.
3. **Fix the label exclusion** to properly quote the slash: `-label:"Duncan/Auto-Drafted"`.
4. **Add diagnostic logs**: query string, message count returned, per-message skip reason. So if anything still gets filtered out, we can see why.
5. **Tighten the "thread already has draft" check** to be thread-scoped (look at `DRAFT` in `thread.messages[].labelIds`) rather than scanning the global last 50 drafts.

## Verification

After deploy, the next scheduled run (≤10 min) will sweep the last 7 days of unread inbox. Expected: up to 20 drafts created in one go (capped by `MAX_DRAFTS_PER_RUN`), then the daily cap of 100 kicks in. Logs will show `query: ... returned: N` with N > 0.

## Files

- `supabase/functions/gmail-auto-draft/index.ts` — query rewrite, logging, draft check fix
