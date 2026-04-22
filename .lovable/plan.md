
## HubSpot integration plan for Duncan

### Scope to support first
Based on your selection, the first HubSpot release would cover:
- Contacts and companies
- Notes and timeline activity
- Create/update actions
- Reporting and summaries

### Current state
There is no existing HubSpot integration in the codebase yet.
That means this would be a net-new integration across:
- backend access layer
- data mapping
- UI entry points
- Duncan chat/tool actions
- permissions and validation

## What would be required

### 1) Connection method
Use the HubSpot connector as a company-level integration so Duncan can access the shared CRM securely without exposing credentials in the frontend.

Implementation would require:
- linking a HubSpot connector to the project
- verifying the connector has the right CRM scopes
- exposing the connection only through backend functions
- showing connection state in the Integrations UI

### 2) Backend integration layer
Add a dedicated backend proxy for HubSpot so the frontend never calls HubSpot directly.

This layer would need endpoints/functions for:
- search contacts
- search companies
- fetch a single contact/company with key properties
- fetch associated notes/activities
- create note
- create or update contact/company
- fetch reporting snapshots for pipeline or account summaries

This layer should:
- validate all inputs
- verify the signed-in user
- restrict write operations to authorized roles if needed
- normalize HubSpot responses into Duncan-friendly shapes

### 3) Data model and field mapping
Define a stable internal mapping between HubSpot fields and Duncan objects.

Minimum mapping set:
- Contact: id, firstname, lastname, email, phone, company, owner, lifecycle stage, last activity date
- Company: id, name, domain, industry, owner, lifecycle stage, last activity date
- Activity/notes: id, type, timestamp, body, author, associations
- Reporting: counts, stage breakdowns, recently active accounts, stale records

This step is important because HubSpot property names are often provider-specific and need clean internal names.

### 4) Duncan chat/action capabilities
Expose HubSpot as a tool-backed capability inside Duncan.

Examples:
- “Find Acme in HubSpot”
- “Show recent activity for this company”
- “Create a note on this contact”
- “Update lifecycle stage”
- “Give me a weekly CRM summary”
- “Which accounts look stalled?”

This requires:
- tool definitions in the chat/action layer
- permission-aware write actions
- structured response formatting for summaries and risks

### 5) UI surfaces
Minimal UI work would likely include:
- Integrations page card for HubSpot
- optional lightweight CRM summary card or panel
- possibly no full standalone HubSpot page in phase 1 if chat-driven access is enough

Recommended first pass:
- add connection/status card
- use Duncan chat as the main interaction surface
- add reporting output only where already consistent with the app

### 6) Reporting layer
To support leadership summaries and RYG-style reporting, add derived reporting functions such as:
- active vs stale contacts/companies
- recent activity volume
- accounts with no recent touchpoints
- basic lifecycle or pipeline distribution
- exceptions/risk signals Duncan can surface proactively

### 7) Security and governance
Required safeguards:
- company-level credential stored server-side only
- authenticated access only
- role checks for write actions
- audit-friendly backend boundaries
- no direct frontend exposure of connector secrets
- clear error handling for missing scopes or expired connection

## Suggested phased rollout

### Phase 1 — Connection + read access
Build:
- HubSpot connection in Integrations
- backend proxy for contacts, companies, notes/activity reads
- Duncan chat read-only queries
- simple CRM summary/reporting output

### Phase 2 — write actions
Build:
- create notes
- create contact/company
- update selected properties
- permission checks around writes

### Phase 3 — reporting and operational intelligence
Build:
- scheduled or on-demand summaries
- stale account detection
- RYG signals
- executive CRM briefs inside Duncan

## Technical details

### Files/components likely involved
- `src/pages/Integrations.tsx` — HubSpot connection/status UI
- `src/components/IntegrationCard.tsx` — reused display component
- `src/lib/api/` — new HubSpot client wrapper
- `supabase/functions/` — new backend proxy functions for HubSpot
- chat/tool orchestration layer — to let Duncan query and act on HubSpot

### Preferred architecture
```text
User / Duncan chat
  -> frontend API wrapper
  -> backend function
  -> connector gateway
  -> HubSpot API
  -> normalized response
  -> Duncan UI / summary / action result
```

### Main implementation dependencies
- HubSpot connector must be linked to the project
- correct CRM scopes must be available
- field mapping must be agreed for contacts, companies, and activities
- write permissions should be defined before enabling update actions

## Recommended first implementation
The smallest high-value version would be:

1. Add HubSpot as a company integration
2. Build read-only contact/company/activity search
3. Make HubSpot queryable from Duncan chat
4. Add basic CRM summary/reporting output
5. Add create/update actions only after read flows are stable

## Expected outcome
After this integration, Duncan would be able to:
- look up CRM records from HubSpot
- summarize account context and recent activity
- surface stale or risky records
- generate leadership reporting from CRM data
- optionally create notes and update records through controlled actions
