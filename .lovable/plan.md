
Root cause: Team Briefing is rendering the persisted `payload.slack_pulse` from the latest `ceo_briefings` row, not a live Slack fetch. The latest stored briefing rows still contain the old values (`channels_member = 0`, `channels_scanned = 0`, `degraded_codes = ["bot_not_invited"]`, `visibility_scope = "partial"`), so the UI is accurately showing stale briefing data rather than the newer Slack logic.

What I’ll do

1. Verify the deployed Slack pulse directly
- Call the deployed `ceo-slack-pulse` function directly.
- Confirm whether it now returns the newer diagnostics:
  - `missing_scope: channels:join`, or
  - `join_failed: <error_code>`, or
  - real joined/scanned channel counts.
- Check recent logs for:
  - `auth.test`
  - join attempts
  - join failures
  - retry outcomes

2. Verify the briefing pipeline is using the current Slack pulse output
- Confirm the deployed `ceo-briefing` function is invoking `ceo-slack-pulse` and persisting its latest response into `ceo_briefings.payload.slack_pulse`.
- If the direct Slack pulse response is correct but the persisted briefing row is still old, identify whether:
  - `ceo-briefing` is using an outdated deployment, or
  - a fresh briefing has simply not been generated since the Slack fix.

3. Regenerate Team Briefing data
- Trigger a fresh morning Team Briefing generation so a new `ceo_briefings` row is written with current Slack diagnostics.
- Re-check the newest `ceo_briefings` row to confirm:
  - updated `degraded_reason`
  - updated `degraded_codes`
  - updated `channels_member`
  - updated `channels_scanned`
  - updated `messages_analysed`

4. Only patch code if the new run still stores stale semantics
- If the direct Slack pulse is correct but the saved briefing still collapses to old wording, update the persistence/normalization path so the stored briefing preserves the exact Slack pulse payload.
- If the direct Slack pulse itself still returns the old payload, redeploy/fix only the affected backend function(s), keeping frontend unchanged unless the stored semantics require a small display adjustment.

Expected outcome
- Team Briefing will stop showing the old `0 of 83 / bot_not_invited / Scanned: 0` state once a fresh briefing is generated from the corrected Slack pulse.
- If the connector is missing scope, the panel will show that exact reason.
- If joins are failing for another reason, the panel will show that exact reason.
- If joins succeed, the panel will show real joined/scanned counts.

Technical details
- `src/hooks/useCEOBriefing.ts` loads the latest `ceo_briefings` row.
- `src/pages/CEOBriefing.tsx` passes `payload.slack_pulse` into `CommsPulseCard`.
- `src/components/ceo/CommsPulseCard.tsx` is only rendering what is already stored.
- The latest database rows currently still store the old Slack pulse payload, so the immediate issue is stale persisted briefing data, not just the card UI.
