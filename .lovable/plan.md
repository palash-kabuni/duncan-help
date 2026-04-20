

## Issues

1. **Token usage absent from briefing output** — the briefing payload includes `token_usage.my_today` and `token_usage.leaderboard`, but the briefing system prompt in `norman-chat/index.ts` (~line 3401) only lists 4 sections and never tells the AI to render token data. It silently drops it.

2. **Briefing shown more than once a day** — gating uses `sessionStorage('duncan_briefing_done')` which is per-tab, and `useAuth.tsx` clears it on every `SIGNED_IN` event (fires on token refresh in some flows). Nimesh's `last_briefing_at` already shows `2026-04-20T05:59:16Z` today — yet briefing would re-fire on a new tab.

## Fix

### 1. Add Token Usage section to briefing prompt
In `supabase/functions/norman-chat/index.ts` (~line 3401-3408), add a 5th section:

> 5. 📊 **Your AI Usage Today** — Show today's `total_tokens` and `request_count` for the user, then the top-3 leaderboard (last 30 days) as a small ranked list. Keep it to 2-3 lines, presented as a light footer.

Also extend section list comment so AI doesn't omit it when data is present.

### 2. Gate briefing to once per calendar day, server-side
Switch the gate from sessionStorage to the existing `profiles.preferences.last_briefing_at` field (already written by `daily-briefing`).

- **`daily-briefing/index.ts`**: at the top, check if `last_briefing_at` is on the same UTC date as `now`. If yes, return `{ already_shown_today: true }` with HTTP 200 and skip all queries (cheap no-op).
- **`src/pages/Index.tsx`**: when response contains `already_shown_today`, do NOT call `sendBriefing()`. Still set the local flag to prevent re-fetch within the tab.
- **`src/hooks/useAuth.tsx`**: remove the `sessionStorage.removeItem("duncan_briefing_done")` on `SIGNED_IN` (keep only on `SIGNED_OUT`). Token-refresh `SIGNED_IN` events were nuking the gate.

Result: first visit of the calendar day → full briefing. Any subsequent visit (new tab, refresh, re-auth) within the same UTC day → silent no-op, no chat message.

## Files

- `supabase/functions/norman-chat/index.ts` — add Token Usage section to briefing prompt
- `supabase/functions/daily-briefing/index.ts` — early return if `last_briefing_at` is today
- `src/pages/Index.tsx` — handle `already_shown_today` response
- `src/hooks/useAuth.tsx` — stop clearing flag on `SIGNED_IN`

## Trade-offs

- **Date boundary**: uses UTC. For a London user that means the day rolls at 00:00 UTC (midnight in winter, 01:00 BST in summer). Acceptable for an internal tool; can switch to user timezone later if needed.
- **Manual re-trigger**: if you ever want to force a fresh briefing same-day, we'd add a "Refresh briefing" button that bypasses the gate. Not in scope unless you ask.

