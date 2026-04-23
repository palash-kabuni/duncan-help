
Goal: make HubSpot and GitHub always visible in Team Briefing Comms Pulse, harden their persisted signal contract, and add diagnosable health reporting without changing the broader Team Briefing architecture.

1. Update Comms Pulse UI to always render HubSpot and GitHub tiles
- Remove the `showHubSpot` / `showGitHub` gating in `src/components/ceo/CommsPulseCard.tsx`.
- Keep Email and Slack behavior unchanged.
- Render HubSpot and GitHub tiles for all three states:
  - `connected`
  - `degraded`
  - `not_configured`
- Expand the external signal tile contract so each tile can display:
  - state badge
  - last sync / last verified time when available
  - short failure reason when available
  - compact metrics summary even in degraded or not_configured states
- Keep the empty-state fallback only for cases where absolutely no comms data exists and no external signal objects are present at all.

2. Harden the backend signal contract in Team Briefing payloads
- In `supabase/functions/ceo-briefing/index.ts`, replace the current lightweight normalization for `hubspot_signal` and `github_signal` with a stable schema that is always written into `payload`:
  - `status`
  - `connected`
  - `last_sync_at`
  - `error_code`
  - `error_message`
  - `metrics_summary`
- Preserve existing fields already used by the UI and briefing provenance so older payload readers continue working:
  - HubSpot: `accounts_scanned`, `stale_deals`, `at_risk_accounts`, `customer_escalations`, `signals`, `summary`, `degraded_reason`
  - GitHub: `repos_scanned`, `open_prs`, `blocked_prs`, `stale_prs`, `release_risks`, `signals`, `summary`, `degraded_reason`
- Backfill compatibility during normalization:
  - map legacy `last_verified_at` / `last_sync` into `last_sync_at`
  - map legacy `degraded_reason` into `error_message`
  - derive `metrics_summary` from the existing numeric metrics when missing
- Keep `source_provenance` text generation compatible with both legacy and hardened shapes.

3. Make HubSpot API status reporting explicit and diagnosable
- In `supabase/functions/hubspot-api/index.ts`, standardize all return paths so every response includes the stable health fields:
  - `status`, `connected`, `last_sync_at` (or equivalent mapped server-side), `error_code`, `error_message`, `metrics_summary`
- Distinguish failure classes explicitly:
  - connector not configured
  - stored token missing
  - stored token decode failed
  - connector verification failed
  - upstream API auth failure
  - upstream API request failure
  - summary generation failure
- Keep existing metrics and summary fields intact for compatibility.
- Add targeted logs at decision points so the degraded / not_configured reason is traceable:
  - credential source used (connector gateway vs stored token)
  - verification outcome
  - missing-token / decode-failure branch
  - upstream request failure branch
  - final returned status and error code

4. Make GitHub API status reporting explicit and diagnosable
- In `supabase/functions/github-api/index.ts`, standardize all return paths to the same stable health schema.
- Add explicit error codes for:
  - missing stored token
  - stored token decode failure
  - user verification failure
  - repo scan partial failure
  - upstream API auth failure
  - summary failure
- Preserve all current GitHub metrics and summary fields.
- Add targeted logs mirroring HubSpot so status transitions are explainable from backend logs.

5. Keep Integrations page compatibility
- Ensure the new health fields remain additive so `src/pages/Integrations.tsx` can continue using existing `status`, `degraded_reason`, and `last_verified_at` behavior without breaking.
- Optionally map new fields back into legacy names inside the API responses so both Team Briefing and Integrations consume the same health contract cleanly.

6. Verification to produce after implementation
- Generate or capture evidence for all three UI states in Comms Pulse:
  - connected state visible
  - degraded state visible
  - not_configured state visible
- Verify persisted Team Briefing payload includes the stable schema for both `hubspot_signal` and `github_signal`.
- Verify backend logs clearly show why each degraded / not_configured status was assigned.

Technical details
- Files to update:
  - `src/components/ceo/CommsPulseCard.tsx`
  - `supabase/functions/ceo-briefing/index.ts`
  - `supabase/functions/hubspot-api/index.ts`
  - `supabase/functions/github-api/index.ts`
- Current root cause:
  - UI currently hides HubSpot/GitHub unless `status === "connected"` or `connected === true`
  - Team Briefing normalization currently persists inconsistent shapes centered on legacy fields like `degraded_reason`
  - API functions currently return useful metrics, but error semantics and diagnostics are not standardized
- Constraints preserved:
  - no architecture changes
  - no Team Briefing flow changes
  - no streaming/tooling changes
  - backward compatibility maintained for existing payload consumers
