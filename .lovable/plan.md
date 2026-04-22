
Implement the missing Team Briefing completion steps with the smallest path that fixes connection state, persistence, and rendering without changing the overall briefing architecture.

1. Connector completion

A. HubSpot: make “not_configured -> connected” real
- Update `supabase/functions/hubspot-api/index.ts`
  - Keep connector-gateway support as first priority when `LOVABLE_API_KEY` + `HUBSPOT_API_KEY` exist.
  - Add fallback credential lookup from `public.company_integrations` for `integration_id = 'hubspot'` when connector secrets are absent.
  - Normalize `status` action to always return:
    - `status`
    - `connected`
    - `last_verified_at`
    - `degraded_reason`
    - counts fields defaulted to `0`
    - `summary` defaulted to `null`
  - For stored company credential fallback:
    - decode `encrypted_api_key`
    - verify against HubSpot before returning `connected`
    - return `degraded` if stored credential exists but fails verification
    - return `not_configured` only if neither connector secret nor stored company credential exists
- Update `supabase/functions/manage-company-integration/index.ts`
  - Allow `hubspot` to be stored through the existing admin-only company integration flow.
  - Keep current `company_integrations` upsert path, but ensure `status` is set to `connected` only after successful verification when possible.
  - On disconnect, keep the existing delete behavior.
- Update `src/pages/Integrations.tsx`
  - Stop treating HubSpot as display-only “connector managed”.
  - Show an actual admin connect path:
    - primary copy: connector-first
    - fallback input: token/API key using existing `handleConnect`
  - After connect/disconnect, re-run `hubspot-api` `status` and refresh `company-integrations`.

B. GitHub: replace placeholder with a real connectable status path
- Update `supabase/functions/github-api/index.ts`
  - Replace the current hardcoded `not_configured` response.
  - Read credential from `public.company_integrations` for `integration_id = 'github'`.
  - Verify with GitHub REST before returning `connected`:
    - `GET /user` for credential validity
    - summary endpoints for briefing data (repos / PRs) only when action is `briefing_summary`
  - Return normalized response shape matching HubSpot style:
    - `status`
    - `connected`
    - `last_verified_at`
    - `degraded_reason`
    - `repos_scanned`, `open_prs`, `blocked_prs`, `stale_prs`, `release_risks`
    - `signals`
    - `summary`
  - Treat missing stored credential as `not_configured`
  - Treat invalid token / API failure as `degraded`, not hard failure
- Update `supabase/functions/manage-company-integration/index.ts`
  - Ensure GitHub token storage works through the existing admin-only company integration flow.
- Update `src/pages/Integrations.tsx`
  - GitHub should use the standard admin connect input immediately, not a dead “Connectors” message.
  - Status drawer must show live `github-api` status, degraded reason, and last verification time.

Assumption:
- HubSpot can use connector secrets or stored company token.
- GitHub should use stored company token because the current project code has no working GitHub connector runtime path.

2. Briefing persistence verification

Update `supabase/functions/ceo-briefing/index.ts`
- Keep the existing parallel fetch of:
  - `ceo-email-pulse`
  - `ceo-slack-pulse`
  - `hubspot-api`
  - `github-api`
- Make signal persistence impossible to skip by hoisting normalized defaults immediately after fetch parsing:
  - `normalizedHubspotSignal`
  - `normalizedGithubSignal`
- Use those normalized objects everywhere instead of raw nullable values:
  - provenance text
  - `company_pulse_status`
  - `sources_unavailable`
  - final payload persistence
- Guarantee both payload fields are always written on every successful briefing save:
  - `payload.hubspot_signal`
  - `payload.github_signal`
- Ensure each always includes:
  - `status`
  - `connected`
  - counts
  - `summary`
  - `signals`
  - `degraded_reason`
- Verify fallback / compact / ultra / deterministic save paths also receive these fields.
- Keep Team Briefing generation non-blocking:
  - if HubSpot fails, briefing still completes with `status: 'degraded'`
  - if GitHub fails, briefing still completes with `status: 'degraded'`
  - if not configured, briefing still completes with `status: 'not_configured'`

3. UI rendering completion

Update `src/pages/CEOBriefing.tsx`
- Pass the new payload fields into the Team Briefing UI instead of dropping them:
  - `hubspotSignal={p.hubspot_signal}`
  - `githubSignal={p.github_signal}`

Update `src/components/ceo/CommsPulseCard.tsx`
- Extend props to accept:
  - `hubspotSignal`
  - `githubSignal`
- Add two compact sections/cards beneath Email/Slack:
  - HubSpot
  - GitHub
- Render exact runtime state, not derived copy:
  - connected / degraded / not configured
  - summary
  - degraded reason
  - key counts
- If `not_configured`, show explicit blind-spot language.
- If `degraded`, show degraded reason from payload.
- Do not hide the sections when counts are zero; only rely on `status`.

4. Integrations page completion details

Update `src/pages/Integrations.tsx`
- For HubSpot:
  - replace the disconnected-state “Connect from Connectors” dead-end with a working admin connection flow
  - keep status polling via `hubspot-api` action `status`
- For GitHub:
  - replace current connector-managed dead-end with working admin token connect flow
  - keep status polling via `github-api` action `status`
- Keep non-admin behavior unchanged: read-only status only
- Keep Slack behavior unchanged except status copy already added

Update `src/hooks/useCompanyIntegrations.ts`
- No schema change required.
- Keep current query/mutation hook, but ensure UI refreshes after connect/disconnect and after live status checks.

5. Schema changes
- No migration required for this completion pass.
- Reuse existing `public.company_integrations` fields:
  - `integration_id`
  - `encrypted_api_key`
  - `status`
  - `last_sync`
  - `updated_by`

6. Acceptance verification after implementation
- HubSpot
  - disconnected -> connect with valid credential -> `hubspot-api status` returns `connected`
  - invalid credential -> `degraded`
  - latest Team Briefing writes non-null `payload.hubspot_signal`
  - `/team-briefing` visibly renders HubSpot section
- GitHub
  - disconnected -> connect with valid token -> `github-api status` returns `connected`
  - invalid token -> `degraded`
  - latest Team Briefing writes non-null `payload.github_signal`
  - `/team-briefing` visibly renders GitHub section
- Resilience
  - one integration disconnected and the other degraded still must not block Team Briefing generation
  - `payload.hubspot_signal` and `payload.github_signal` remain present in the saved row with consistent `status` + `degraded_reason`

7. Exact files to update
- `supabase/functions/hubspot-api/index.ts`
- `supabase/functions/github-api/index.ts`
- `supabase/functions/manage-company-integration/index.ts`
- `supabase/functions/ceo-briefing/index.ts`
- `src/pages/Integrations.tsx`
- `src/components/ceo/CommsPulseCard.tsx`
- `src/pages/CEOBriefing.tsx`

Implementation order
1. `github-api` real credential/status path
2. `hubspot-api` dual-source credential/status path
3. `manage-company-integration` verification-aware upsert
4. `Integrations.tsx` connect flow fixes
5. `ceo-briefing` normalized persistence guarantees
6. `CEOBriefing.tsx` + `CommsPulseCard.tsx` rendering
7. regenerate one briefing and verify latest row contains both signal objects
