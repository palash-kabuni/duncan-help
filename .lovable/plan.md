
Update only `supabase/functions/ceo-slack-pulse/index.ts` so the Slack pulse surfaces the real public-channel join failure reason instead of collapsing everything into generic `bot_not_invited`.

## What I’ll change

### 1. Add a one-time startup scope check
- Call `auth.test` once near the start of the function.
- Log:
  - Slack bot/user identifiers already returned there
  - the granted OAuth scopes (or whatever scope field Slack/gateway returns)
- If `channels:join` is not present:
  - set `degraded: true`
  - set `degraded_reason: "missing_scope: channels:join"`
  - add an appropriate degraded code if needed without redesigning the response
  - skip the join-and-retry path entirely
- History scanning for already-accessible channels stays intact; only the auto-join branch is disabled.

### 2. Make join attempts explicitly observable
- In the public-channel join fallback, log for every `conversations.join` attempt:
  - channel ID
  - HTTP status
  - exact Slack error code
- Preserve the current join-then-retry structure, but stop reducing failures to generic warnings.
- Ensure the log output clearly distinguishes:
  - attempted join
  - join succeeded
  - join failed with exact error
  - history retry failed after join

### 3. Return exact join failures in the payload
- For unresolved joins, return them in `channels_with_errors` as:
  - `status_reason: "join_failed: <error_code>"`
- Keep unresolved history-after-join failures distinct, for example:
  - `history_failed_after_join: <error_code>`
- Do not swallow gateway or Slack-specific errors like:
  - `missing_scope`
  - `not_allowed_token_type`
  - `channel_not_found`

### 4. Surface the dominant failure reason in `degraded_reason`
- Track all join error codes encountered during the run.
- If every attempted join fails with the same exact code:
  - surface that single code in `degraded_reason`
  - example: `join_failed: missing_scope`
- If errors are mixed:
  - keep the current aggregate wording, but include the counts and unresolved status
  - do not pretend the issue is only `bot_not_invited`

### 5. Keep all existing scope boundaries
- No auth changes
- No connector gateway changes
- No private-channel behavior changes
- No response contract redesign
- No edits to any other function or frontend file

## Expected outcome
After this change, the Slack panel will reveal the real reason the auto-join path is failing:
- if the connector is missing `channels:join`, the UI will show `missing_scope: channels:join`
- if join calls are failing for another reason, that exact Slack error will appear in logs and payload
- `bot_not_invited` will no longer mask join failures that are actually scope or token issues

## Technical details
- File: `supabase/functions/ceo-slack-pulse/index.ts`
- Keep current public-channel discovery and scan flow
- Add a small helper around `auth.test` for scope extraction/logging
- Extend the join helper to capture both HTTP status and Slack error code
- Update aggregation so `channels_with_errors` and `degraded_reason` reflect exact join failure semantics
- Preserve current metrics and private blind-spot handling outside this diagnostic improvement
