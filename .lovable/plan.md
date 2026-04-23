
Update only `supabase/functions/ceo-slack-pulse/index.ts` to add a public-channel join-and-retry path before history is marked inaccessible.

What will change

1. Join-then-retry for public channels
- Keep channel discovery as public channels only.
- Stop treating `is_member === false` as an automatic blind spot.
- For each eligible public channel, call `conversations.history` first.
- If Slack returns `bot_not_invited` or `not_in_channel`, immediately call `conversations.join` for that same public channel.
- If `conversations.join` succeeds, retry `conversations.history` once and use the returned messages normally.
- If `conversations.join` fails, or history still fails after a successful join, mark that channel as inaccessible and keep scanning the rest.
- Do not add any private-channel join logic.

2. Keep current scope boundaries
- No auth changes.
- No connector gateway changes.
- No request/response contract redesign.
- No changes to any other edge function.
- Private channels remain gated exactly as they are today and continue to contribute only to the private-visibility warning/count.

3. Update channel selection so newly joined channels can actually be scanned
- Build the eligible scan set from public, non-archived channels rather than only current `is_member` channels.
- Keep the existing cap/sorting strategy so the function still scans a bounded set.
- This ensures channels Duncan joins during the run can contribute real `messages_analysed` and signal output.

4. Return counts that match the new behavior
- `messages_analysed` should include messages from channels that were successfully joined during this run.
- `channels_scanned` should reflect channels whose history was actually fetched after the final retry path.
- `channels_member` should reflect effective accessible public channels after successful join attempts for the scanned set.
- `not_member_channels_count` should represent only channels still inaccessible after join was attempted.
- `history_failures_count` should count real unresolved failures, not pre-join non-membership.
- `channels_with_errors` / `per_channel.status_reason` should distinguish:
  - joined_then_scanned
  - join_failed
  - history_failed_after_join
  - no_recent_messages
  - private_inaccessible (unchanged behavior for private blind spots if already surfaced)

5. Fix degraded and warning logic
- Only emit `bot_not_invited` when a public channel remained inaccessible after `conversations.join` was attempted and failed.
- Do not add `bot_not_invited` merely because the bot started outside the channel.
- Keep `private_channels_inaccessible` behavior unchanged.
- Keep `history_partial_failure` only for genuine unresolved history failures.
- Recompute `degraded` / `visibility_scope` from final post-retry outcomes:
  - fully healthy if public channels in scope were joined/scanned successfully
  - partial only when unresolved public failures or private blind spots remain
- Update `degraded_reason` so the UI can clearly communicate:
  - how many public channels were successfully joined
  - how many channels were scanned
  - how many channels are still inaccessible
  - whether remaining blind spots are public join failures and/or private channels

Expected UI outcome without changing other files
- The Slack badge will show real message totals because joined public channels now contribute to `messages_analysed`.
- The existing “Duncan in X of Y” / “not invited” display will reflect post-join reality rather than pre-join membership.
- The warning will only mention `bot_not_invited` for channels where `conversations.join` also failed.
- Private-channel visibility remains unchanged and still clearly separated from the public join flow.

Implementation notes
- Add a small helper inside `ceo-slack-pulse` for “history with join fallback” rather than refactoring the whole function.
- Preserve existing message filtering, signal extraction, and aggregation logic once messages are successfully fetched.
- Keep the response shape compatible with the current Team Briefing consumer, only improving the semantics of the existing fields and per-channel statuses.
