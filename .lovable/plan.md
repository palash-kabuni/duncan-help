
Goal: eliminate the persistent 401 state for HubSpot and GitHub when valid credentials exist, while preserving explicit `degraded` / `not_configured` behavior for invalid or absent credentials.

Current diagnosis
- HubSpot is currently failing from the stored-token path, not the connector path.
  - Latest runtime log: `hubspot_invalid_token`
  - Provider response: `401`
  - Upstream message: `Authentication credentials not found. This API supports OAuth 2.0 authentication...`
- GitHub is also currently failing from the stored-token path.
  - Latest runtime log: `github_invalid_token`
  - Provider response: `401`
  - Upstream message: `Bad credentials`
- Workspace/project connector state confirms the root cause:
  - Only Slack is linked to this project.
  - No HubSpot connector is linked.
  - No GitHub connector is linked.
- Because no HubSpot/GitHub connector secrets are available, the runtime falls back to `company_integrations.encrypted_api_key`.
- The stored credentials being used for both providers are currently invalid for the verification endpoints, so the UI is correctly showing failure, but not because the runtime path is healthy.

What to build
1. Tighten the runtime diagnosis so the UI distinguishes:
- invalid stored token
- missing stored token
- connector not linked to project
- connector linked but verification failed
- insufficient scope
- expired/revoked token
- verification-flow mismatch

2. Prefer connector-backed credentials when available, but make the source explicit in health payloads
- Add a non-sensitive `credential_source` field to HubSpot/GitHub runtime responses:
  - `connector_gateway`
  - `stored_token`
  - `none`
- Keep current fields intact for backward compatibility.

3. Harden status semantics so `connected` only appears when the exact credential source used at runtime passes verification
- If connector secrets exist and verification passes: `connected`
- If connector secrets exist and verification fails: `degraded`
- If no connector secrets exist but a stored token exists and passes verification: `connected`
- If no connector secrets exist and no stored token exists: `not_configured`
- If stored token exists and fails verification: `degraded`

4. Improve UI messaging so the 401 cause is diagnosable in both Team Briefing and Integrations
- Surface short, non-sensitive reason text based on `error_code`
- Show whether the failing source is the project connector or stored company token
- Keep current always-visible HubSpot/GitHub tiles in Comms Pulse

Implementation steps
1. Update `supabase/functions/hubspot-api/index.ts`
- Add explicit response metadata:
  - `credential_source`
  - `verification_path`
- Split the current connector/stored-token branches into clearly logged outcomes:
  - connector unavailable
  - connector verification failed
  - stored token missing
  - stored token invalid
- Refine HubSpot 401 classification to map the current upstream message (`Authentication credentials not found`) to a clearer code such as:
  - `hubspot_missing_oauth_token` or `hubspot_invalid_token`
- Preserve existing stable fields:
  - `status`, `connected`, `last_sync_at`, `error_code`, `error_message`, `metrics_summary`

2. Update `supabase/functions/github-api/index.ts`
- Add the same metadata:
  - `credential_source`
  - `verification_path`
- Keep stored-token verification against `/user`, but classify `Bad credentials` explicitly and consistently
- Preserve the same stable response contract

3. Update `supabase/functions/manage-company-integration/index.ts`
- Align connect-time verification output with runtime output
- Store or return richer diagnostics so a token that fails at connect-time is visibly the same class of failure seen at runtime
- Do not change token storage mechanics beyond diagnosis and status accuracy

4. Update `supabase/functions/ceo-briefing/index.ts`
- Preserve the existing normalized payload contract
- Add passthrough support for the new additive fields:
  - `credential_source`
  - `verification_path`
- Keep backward compatibility for existing briefing payload readers

5. Update `src/components/ceo/CommsPulseCard.tsx`
- Continue rendering HubSpot/GitHub in all states
- Add compact display of:
  - credential source
  - clearer failure reason text
  - existing error code
- No change to broader card layout or other comms tiles

6. Update `src/pages/Integrations.tsx`
- Use runtime status detail to show the exact source of failure
- Replace generic “pending/degraded” messaging with diagnosable labels such as:
  - “Stored token invalid”
  - “Connector not linked”
  - “Missing required permissions”
- Keep overall integration card behavior unchanged

Expected outcome
- The UI will stop showing ambiguous 401 failures and instead show exactly why HubSpot/GitHub are degraded.
- If valid connector credentials are linked to the project, runtime status will move to `connected`.
- If valid stored tokens are present, runtime status will also move to `connected`.
- If credentials remain invalid, the UI will still show `degraded`, but with a precise, diagnosable cause.

Verification to perform after implementation
- HubSpot:
  - no credential → `not_configured`
  - invalid stored token → `degraded`
  - valid connector or valid stored token → `connected`
- GitHub:
  - no credential → `not_configured`
  - invalid stored token → `degraded`
  - valid stored token → `connected`
- Confirm logs show:
  - credential source used
  - provider status
  - classified `error_code`
  - no secret leakage

Important finding to act on first
- Right now this project does not have HubSpot or GitHub connectors linked at all, so even perfect connector logic cannot make them connected until those connections are linked or valid company tokens are supplied.
