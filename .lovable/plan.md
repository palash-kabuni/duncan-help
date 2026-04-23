
Goal: diagnose HubSpot/GitHub 401s precisely, make valid credentials resolve to `connected`, preserve `degraded` / `not_configured` for invalid credentials, and add clear non-sensitive diagnostics.

1. Harden credential diagnosis in the integration verification entrypoint
- Update `supabase/functions/manage-company-integration/index.ts` so HubSpot and GitHub verification returns structured diagnostics instead of a single generic error string.
- Add provider-specific parsing for common auth failures:
  - missing token / empty token
  - invalid token / bad credentials
  - expired or revoked token
  - insufficient scope / permission
  - verification endpoint mismatch / unsupported token type
  - rate-limited or provider unavailable
- Return a normalized verification payload with:
  - `status`
  - `connected`
  - `error_code`
  - `error_message`
  - `last_verified_at`
- Keep token storage behavior unchanged except for setting status from the richer verification result.

2. Make runtime status functions use the same diagnosis rules
- Refactor `supabase/functions/hubspot-api/index.ts` and `supabase/functions/github-api/index.ts` so 401/403 paths are classified consistently in both:
  - initial verification
  - summary fetch
  - partial downstream fetch failures
- Preserve current stable response contract:
  - `status`
  - `connected`
  - `last_sync_at`
  - `error_code`
  - `error_message`
  - `metrics_summary`
- Ensure valid credentials always produce `connected` on the `status` action.
- Ensure invalid credentials never silently look connected.

3. Fix provider-specific token/verification mismatches
- HubSpot:
  - Keep existing connector-gateway path when project connector secrets are actually present.
  - Improve fallback to stored company token when gateway secrets are absent.
  - Diagnose whether failure is from connector verification, direct API auth, or permission mismatch.
- GitHub:
  - Keep stored-token flow, but verify against `/user` with richer response classification.
  - Distinguish “not configured” from “configured but invalid”.
- Ensure the same stored token that passes verification is the one used for later summary fetches, so status does not flip incorrectly between connect-time and runtime.

4. Add non-sensitive logging for diagnosis
- In both runtime functions and `manage-company-integration`, add targeted logs at:
  - credential source selected
  - verification endpoint called
  - provider response status
  - classified failure type
  - final returned `status` and `error_code`
- Log only safe metadata:
  - source (`connector_gateway` vs `stored_token`)
  - HTTP status
  - provider error category/message snippet
  - token fingerprint metadata only if needed (prefix length / token length), never the token itself
- Remove ambiguity around current generic branches like “verification failed” by logging the actual classified cause.

5. Keep UI and integration health behavior intact
- Do not change existing connected/degraded/not_configured semantics in the Team Briefing UI.
- Preserve the current backend contract used by:
  - `src/pages/Integrations.tsx`
  - `src/components/ceo/CommsPulseCard.tsx`
  - `supabase/functions/ceo-briefing/index.ts`
- Only improve diagnosis and correctness of status transitions.

6. Verification after implementation
- Test HubSpot with:
  - no token
  - invalid token
  - valid token
- Test GitHub with:
  - no token
  - invalid token
  - valid token
- Confirm for each case:
  - exact `error_code` matches the real cause
  - valid credentials return `connected`
  - invalid credentials return `degraded`
  - absent credentials return `not_configured`
  - logs clearly show the decision path without exposing secrets

Technical details
- Files to update:
  - `supabase/functions/manage-company-integration/index.ts`
  - `supabase/functions/hubspot-api/index.ts`
  - `supabase/functions/github-api/index.ts`
- Important current findings:
  - HubSpot already has two paths: connector-gateway if connector secrets exist, otherwise stored company token.
  - GitHub currently uses only stored company token.
  - The workspace currently shows a Slack connector only, so HubSpot/GitHub likely rely on stored tokens right now unless connectors are later linked.
  - `manage-company-integration` currently stores any submitted token and only marks it `degraded` with a generic message on failure; it does not preserve a precise auth diagnosis.
  - `hubspot-api` / `github-api` currently collapse several 401/403 cases into broad codes such as `connector_verification_failed`, `upstream_auth_failed`, or `user_verification_failed`.
