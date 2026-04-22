
## Phase 2 Execution Blueprint — Integration-first Team Briefing

### Assumptions
- Team Briefing remains orchestrated by `supabase/functions/ceo-briefing/index.ts`.
- Existing `company_integrations` is the shared status surface for company-level integrations.
- Slack uses the existing connector secret already present.
- GitHub and HubSpot are new company-level integrations and must degrade cleanly when not connected.
- No UI redesign; only targeted additions to Integrations and Team Briefing transparency surfaces.

---

## 1. Architecture Changes

### A. HubSpot integration

#### Create
- `supabase/functions/hubspot-api/index.ts`
  - New authenticated edge function.
  - Actions:
    - `status`
    - `briefing_summary`
    - optional `disconnect` passthrough only if needed later, but not required for Phase 2
  - Uses connector gateway, not raw API keys.
  - `status` returns connected/degraded/not_configured plus last verification metadata.
  - `briefing_summary` returns a compact normalized CRM slice for Team Briefing.

- `src/lib/api/hubspot.ts`
  - Thin client wrapper around `supabase.functions.invoke("hubspot-api")`.

#### Update
- `supabase/functions/ceo-briefing/index.ts`
  - Add parallel fetch for `hubspot-api` alongside existing email/slack pulses.
  - Treat failures as non-fatal.
  - Persist a normalized `payload.hubspot_signal`.
  - Add HubSpot to `sources_unavailable` only when not connected / failed / empty.
  - Use HubSpot evidence only as an additive signal in:
    - risks
    - decisions
    - company pulse narrative
  - Never block briefing completion.

- `src/pages/Integrations.tsx`
  - Add visible company integration card for `hubspot`.
  - Show connection state from `company_integrations`.
  - Use existing company mutation path for connect/disconnect if manual token entry is still the smallest path.
  - If connector-first is chosen at execution time, replace manual connect CTA with connector-linked status text but keep card layout unchanged.

#### Expected normalized Team Briefing payload
- `payload.hubspot_signal = { status, accounts_scanned, stale_deals, at_risk_accounts, escalations, summary, degraded_reason? }`

---

### B. GitHub integration

#### Create
- `supabase/functions/github-api/index.ts`
  - New authenticated edge function.
  - Actions:
    - `status`
    - `briefing_summary`
  - Pulls repository delivery signals through connector/gateway if available; otherwise returns `not_configured`.
  - Returns compact engineering delivery summary only.

- `src/lib/api/github.ts`
  - Thin client wrapper for `github-api`.

#### Update
- `supabase/functions/ceo-briefing/index.ts`
  - Add parallel fetch for `github-api`.
  - Persist `payload.github_signal`.
  - Feed GitHub summary into:
    - risks
    - delivery / execution explanation
    - decisions when engineering delivery is blocked
  - If unavailable, record explicit blind spot rather than silently omitting.

- `src/pages/Integrations.tsx`
  - Add visible company integration card for `github`.
  - Surface status and last verification / last sync if available.

#### Expected normalized Team Briefing payload
- `payload.github_signal = { status, repos_scanned, open_prs, blocked_prs, stale_prs, release_risks, summary, degraded_reason? }`

---

### C. Slack hardening

#### Update
- `supabase/functions/ceo-slack-pulse/index.ts`
  - Keep existing scan flow intact.
  - Add explicit degraded-state structure instead of a single free-text `degraded_reason`.
  - Expand response to include:
    - `visibility_scope`: `"full_public"` | `"public_only"` | `"partial"` | `"not_configured"`
    - `degraded_codes`: string[]
    - `inaccessible_private_channels_count`
    - `not_member_channels_count`
    - `history_failures_count`
    - `channels_with_errors`
    - per-channel `status_reason`
  - Keep existing `signals` payload unchanged so downstream logic does not break.
  - Continue returning `ok: true` for degraded-but-usable scans.

- `supabase/functions/ceo-briefing/index.ts`
  - Preserve current Slack invocation.
  - Store richer Slack visibility metadata under `payload.slack_pulse`.
  - Use degraded codes to make Team Briefing explicitly state partial visibility.
  - Do not classify degraded Slack as full failure if some channels were scanned.

- `src/components/ceo/CommsPulseCard.tsx`
  - Extend `SlackPulseSummary` type with new fields.
  - Replace current generic “Reduced coverage” copy with concrete cause(s):
    - public only
    - bot not invited to channels
    - private channels inaccessible
    - history partially failed
    - connector not configured
  - Show counts already returned by backend.
  - Keep layout intact; only add targeted diagnostic lines.

---

## 2. Minimal DB / Schema Changes

### Required: none for MVP Phase 2
Use existing `company_integrations` table for:
- `integration_id`
- `status`
- `last_sync`
- `updated_at`

This is enough for:
- HubSpot connected / disconnected status
- GitHub connected / disconnected status
- existing Slack connector visibility via function-level checks

### Optional but useful small migration
Only if execution needs better operator visibility on Integrations page without extra function calls:
- add nullable `metadata jsonb default '{}'::jsonb` to `public.company_integrations`

Use cases:
- store `last_verified_at`
- store `degraded_reason`
- store `visibility_scope`
- store `repos_scanned` / `accounts_scanned`

If keeping smallest path, skip this migration and compute status via edge `status` actions instead.

---

## 3. Edge Functions / Actions to Create

### New function: `supabase/functions/hubspot-api/index.ts`
#### Actions
- `status`
  - returns:
    - `connected: boolean`
    - `status: "connected" | "not_configured" | "degraded" | "failed"`
    - `last_verified_at`
    - `degraded_reason?`
- `briefing_summary`
  - returns:
    - `ok`
    - `status`
    - `accounts_scanned`
    - `stale_deals`
    - `at_risk_accounts`
    - `customer_escalations`
    - `signals`
    - `summary`
    - `degraded_reason?`

#### Fallback behavior
- If connector missing/not linked: return `ok: true`, `status: "not_configured"`, zero counts, no throw.
- If upstream call partially fails: return `status: "degraded"`.
- Only throw 401/403 for auth failures from caller, not missing integration.

---

### New function: `supabase/functions/github-api/index.ts`
#### Actions
- `status`
  - returns:
    - `connected`
    - `status`
    - `last_verified_at`
    - `degraded_reason?`
- `briefing_summary`
  - returns:
    - `ok`
    - `status`
    - `repos_scanned`
    - `open_prs`
    - `blocked_prs`
    - `stale_prs`
    - `release_risks`
    - `signals`
    - `summary`
    - `degraded_reason?`

#### Fallback behavior
- If connector missing/not linked: return `not_configured`, not failure.
- If some repos fail: return `degraded` with partial counts.
- Team Briefing continues regardless.

---

### Update function: `supabase/functions/ceo-slack-pulse/index.ts`
#### Add fields
- top-level:
  - `visibility_scope`
  - `degraded_codes`
  - `inaccessible_private_channels_count`
  - `not_member_channels_count`
  - `history_failures_count`
  - `channels_with_errors`
- per-channel:
  - `status_reason`

#### Degraded codes to standardize
- `connector_not_configured`
- `missing_scope`
- `public_only_visibility`
- `private_channels_inaccessible`
- `bot_not_invited`
- `history_partial_failure`
- `auth_failed`

---

### Update function: `supabase/functions/ceo-briefing/index.ts`
#### Exact changes
- In the current “Scanning email and slack signals” block, extend the existing `Promise.all` to also call:
  - `hubspot-api` with `{ action: "briefing_summary" }`
  - `github-api` with `{ action: "briefing_summary" }`
- Normalize four source outcomes:
  - email
  - slack
  - hubspot
  - github
- Add non-fatal error trackers:
  - `hubspot_signal_error`
  - `github_signal_error`
- Persist to payload:
  - `payload.hubspot_signal`
  - `payload.github_signal`
- Update narrative injection points:
  - `payload.company_pulse_status`
  - `payload.execution_explanation`
  - `payload.decisions`
  - `payload.risks`
- Update `sources_unavailable` logic:
  - do not hardcode `hubspot`
  - include `hubspot` / `github` only when `status !== "connected"` or summary is absent
  - keep Slack marked separately when degraded vs missing

#### Non-breaking rule
If any of the four source calls fail, briefing still proceeds with remaining evidence.

---

## 4. Integrations Page Updates Required

### Update `src/pages/Integrations.tsx`

#### Integration catalog additions
Add two company integrations:
- `hubspot`
- `github`

Suggested categories:
- HubSpot → `Communication` or `Revenue`
- GitHub → `Operations` or `Engineering`

#### Status handling
- Reuse `useCompanyIntegrations()` for baseline connection state.
- Add lightweight status checks via edge functions when detail modal opens:
  - `hubspot-api` action `status`
  - `github-api` action `status`
- Keep existing card grid and detail drawer intact.

#### Detail drawer behavior
For HubSpot and GitHub cards:
- show status badge
- show “Used by Team Briefing”
- show last verified / degraded reason when available
- show connect/disconnect CTA only if admin
- non-admins see read-only status

#### Slack detail improvement
- add copy explaining:
  - only channels Duncan can access are visible
  - private channels require invitation / scope
  - degraded state affects Team Briefing confidence

No new page, no new modal, no redesign.

---

## 5. Acceptance Tests

### HubSpot
1. **Not configured**
   - `hubspot-api status` returns `not_configured`
   - Team Briefing still generates
   - `payload.hubspot_signal.status = "not_configured"`
   - UI does not crash
   - blind spot is explicit

2. **Configured and healthy**
   - `hubspot-api briefing_summary` returns non-zero or zero valid counts
   - Team Briefing includes `payload.hubspot_signal.summary`
   - no briefing failure
   - Integrations card shows connected

3. **Configured but partial failure**
   - upstream partial error returns `status = "degraded"`
   - Team Briefing still generates
   - degraded reason visible in payload/UI
   - no unhandled exception

---

### GitHub
1. **Not configured**
   - `github-api status` returns `not_configured`
   - Team Briefing still generates
   - `payload.github_signal.status = "not_configured"`

2. **Configured and healthy**
   - `github-api briefing_summary` returns repo/pr metrics
   - Team Briefing includes GitHub summary and can mention engineering delivery signals

3. **Partial repo failure**
   - one or more repos fail but function returns `degraded`
   - briefing completes
   - degraded reason visible

---

### Slack hardening
1. **Connector missing**
   - `ceo-slack-pulse` returns non-fatal not-configured response
   - Team Briefing still generates
   - UI shows Slack unavailable, not blank

2. **Public-only visibility**
   - response includes `visibility_scope = "public_only"`
   - `degraded_codes` includes `public_only_visibility`
   - Comms Pulse renders explicit limitation text

3. **Bot not invited to some channels**
   - `not_member_channels_count > 0`
   - UI shows count and expandable list
   - briefing still uses scanned channels

4. **Partial history failures**
   - `history_failures_count > 0`
   - degraded state shown
   - signals from successful channels still included

---

## Recommended execution order

1. Create `hubspot-api`
2. Create `github-api`
3. Harden `ceo-slack-pulse` response contract
4. Wire all three into `ceo-briefing`
5. Update `CommsPulseCard` for Slack degraded clarity
6. Update `Integrations.tsx` to expose HubSpot/GitHub and improved Slack visibility
7. Run acceptance tests in the order above

This is the smallest high-impact path because it adds missing signal sources and improves partial-visibility honesty without changing the existing Team Briefing generation architecture.
