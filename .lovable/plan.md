
## Team Briefing read-only audit

### Executive summary
Team Briefing is a hybrid pipeline centered on `supabase/functions/ceo-briefing/index.ts`. It pulls deterministic evidence from database tables and integration proxies, sends a compressed context to the LLM, then aggressively post-processes the output with server-side guardrails before persisting to `ceo_briefings`. Today the system is functioning, but evidence quality is structurally capped by sparse workstream coverage, thin artifact coverage in `project_files`, and limited inbound comms coverage. The latest live row shows:
- `coverage_summary`: **1 of 6 priorities covered** (`ratio: 0.17`)
- `confidence_cap`: **low**
- headline forced to **30% probability / 35 execution**
- trajectory: **Off Track**

---

## 1) Current architecture

### Entry points
- UI route: `src/pages/CEOBriefing.tsx` mounted at `/team-briefing` (`src/App.tsx`)
- Frontend hook: `src/hooks/useCEOBriefing.ts`
  - loads latest two `ceo_briefings`
  - invokes `ceo-briefing`
  - polls `ceo-briefing-status`
- Generator edge function: `supabase/functions/ceo-briefing/index.ts`
- Job-status edge function: `supabase/functions/ceo-briefing-status/index.ts`

### Pipeline
```text
UI button
→ ceo-briefing
→ create ceo_briefing_jobs row
→ background worker (EdgeRuntime.waitUntil)
→ gather DB + integration evidence
→ call LLM
→ apply deterministic guardrails / fallback logic
→ upsert ceo_briefings
→ ceo-briefing-status polled by UI
→ render payload sections
```

### Services/functions used by Team Briefing
- `ceo-briefing`
- `ceo-briefing-status`
- `ceo-email-pulse`
- `ceo-slack-pulse`
- shared LLM router: `supabase/functions/_shared/llm.ts`

---

## 2) Data flow and processing

### Gathered sources inside `ceo-briefing`
Main fetch block: around lines `1136-1169` in `supabase/functions/ceo-briefing/index.ts`.

It reads:
- `meetings`
- `workstream_cards`
- `workstream_activity`
- `azure_work_items`
- `releases`
- `candidates`
- `purchase_orders`
- `issues`
- `sync_logs`
- `profiles`
- previous `ceo_briefings`
- `slack_notification_logs`
- `token_usage`
- `xero_invoices`
- `xero_contacts`
- `integration_audit_logs`
- full open `workstream_cards` set
- full `azure_work_items` set
- latest 10 transcript-bearing meetings
- `project_files`

### Comms pulse side-calls
`ceo-briefing` also invokes:
- `ceo-email-pulse`
- `ceo-slack-pulse`

Those produce structured summaries later copied into:
- `payload.email_pulse`
- `payload.slack_pulse`

### AI vs deterministic split
Deterministic:
- available workstreams
- priority coverage detection
- transcript priority signal scan
- data coverage audit
- confidence caps
- company pulse R/Y/G
- risk reconciliation
- friction filtering
- decisions floor
- watchlist
- adoption metrics
- persistence and job orchestration

AI-authored first draft:
- `tldr`
- `what_changed`
- `risks`
- `friction`
- `leadership`
- `decisions`
- `automation`
- `document_intelligence`
- `missing_artifacts_recommendations`
- narrative prose fields

Server then rewrites/clamps many of these.

---

## 3) Data model and scoring

### Priorities and workstreams
Canonical priorities are hardcoded in `PRIORITY_DEFINITIONS` in `ceo-briefing/index.ts`:
1. Lightning Strike India
2. 1M KPL registrations
3. Trials
4. 10-team selection
5. 100k pre-orders
6. Duncan automates 25%

### Workstream representation
`available_workstreams` is the union of:
- `workstream_cards.project_tag`
- `azure_work_items.project_name`

Current live state:
- only **3 active workstream tags**
- only **1 priority** matches aliases: `Lightning Strike Event`

### Coverage computation
Function: `detectCoverage(...)` around lines `1007-1034`
- matches priority aliases only against available workstream names
- never against card titles
- first match wins
- server rebuilds `payload.coverage_gaps`
- server sets `payload.coverage_summary`

### Probability / execution / confidence cap
1. **Coverage clamp**
   - if `coverage_ratio < 0.5`
   - probability capped to `35`
   - execution capped to `40`
   - trajectory forced to `At Risk` or `Off Track`
   - implemented around `2221-2241`

2. **Data coverage cap**
   - from `computeDataCoverage(...)`
   - if 1+ critical red domain → cap `medium`
   - if 3+ red domains or both `finance_planning` + `technology_direction` red → cap `low`
   - then stronger cap wins
   - implemented around `2243-2279`, `980-1004`

3. **Current live outcome**
   - workstream coverage clamp + data coverage cap stack down to:
   - **30% probability / 35 execution / low confidence**

### Company Pulse
Deterministic in lines `2857-2971`
- **Green**: full coverage, no blockers, recent execution evidence
- **Red**: coverage < 0.5, or Lightning Strike untracked, or 2+ silent priorities, or 2+ major blockers
- **Yellow**: everything else

### Risk model
- AI proposes risks
- server injects silent-priority risks if missing
- server upgrades severity if headline is red but radar lacks high/critical
- server reconciles `sum(probability_impact_pts)` to `100 - outcome_probability`
- output stored in `payload.risk_reconciliation`

### Fallback / deterministic mode / truncation
If model output is truncated:
- try compact retry
- then ultra-compact retry
- then deterministic fallback object via `buildDeterministicFallback()`
- implemented around `1906-2051`
- saved generation metadata goes into `payload.generation_meta`

---

## 4) Source coverage audit

### Active sources today
From `company_integrations` and live tables:
- Azure DevOps: connected, last sync `2026-04-22 07:28`, 1492 items
- Gmail: connected, 11 tokens, 8 opted-in mailboxes
- Google Drive: connected, 1 token, last token update `2026-04-19`
- Xero: connected, last sync `2026-04-22 06:00`, 353 invoices
- Notion: connected, but not used in Team Briefing pipeline
- Slack connector: linked to project via workspace connector; not represented in `company_integrations`

### Entities/signals used
- Workstreams: card updates, owners, RAG baseline
- Azure: work item title/state/assignee/project
- Meetings: title, summary, transcript, participants
- Files: `project_files.file_name` and `extracted_text` only indirectly for doc review
- Gmail pulse: commitments, risks, escalations, board mentions, customer issues, silent leaders
- Slack pulse: commitments, escalations, confusion, customer issues, risks, channel coverage metadata
- Xero: invoices + overdue contacts
- Token usage: adoption/leverage metrics
- Issues/sync logs/releases/POs: supporting evidence

### Freshness logic
- primary activity window: last 24h
- transcript priority scan: last 10 meetings with transcripts
- calendar enrichment: last 7 days
- token usage: last 30 days
- workstream coverage uses full open set, not just 24h

### Live blind spots causing low-evidence briefings
- only **1/6 priorities** mapped to workstreams
- only **5 project files** total
- strategic artifact coverage only **9%**
- 8 domains effectively missing/under-covered in latest row
- Slack inbound scan currently sees **0 member channels scanned out of 83 total**
- Google Drive is connected, but Team Briefing does **not** query Drive directly; it only sees what has already been uploaded into `project_files`
- no HubSpot ingestion in briefing
- no GitHub ingestion in briefing
- friction meta explicitly marks `hubspot` as unavailable

---

## 5) Integration health status

### Google Drive: exact current failure points
Drive auth/proxy exists:
- `google-drive-auth/index.ts`
- `google-drive-callback/index.ts`
- `google-drive-api/index.ts`

What works today:
- one shared token exists in `google_drive_tokens`
- Drive files can be listed/read via the proxy and Norman tools

Why it still does not improve Team Briefing much:
1. Team Briefing does **not** read Drive directly
2. `computeDataCoverage()` relies on `project_files` plus meeting titles, not live Drive contents
3. current `project_files` inventory is only **5 files**
4. the callback deletes all existing drive tokens and stores a singleton token, so coverage is effectively shared/sparse rather than broad per-user evidence
5. no live logs surfaced for drive functions in analytics during this audit

So the issue is less “Drive auth broken” and more “Drive evidence is not feeding the briefing unless documents are uploaded into `project_files`.”

### Slack
What exists:
- Slack connector linked to project
- configured scopes currently include:
  - `channels:history`, `channels:read`, `chat:write`, `chat:write.customize`, `groups:history`, `im:read`, `im:write`, `mpim:*`
- `ceo-slack-pulse` scans public channels through the connector gateway
- outbound events also exist in `slack_notification_logs`

What is limiting it:
- current connector config lacks `groups:read`
- code intentionally lists only `public_channel`
- latest briefing provenance: scanned **0 of 0 member channels** out of **83 total**
- bot is not in relevant channels, so no inbound evidence is available

### GitHub
- No GitHub connector, no GitHub tables, no GitHub ingestion in Team Briefing code found

### HubSpot
- No HubSpot integration path in Team Briefing
- `ceo-briefing` explicitly includes `hubspot` in unavailable sources for friction metadata
- no HubSpot tables/functions found in briefing path

---

## 6) Reliability and observability audit

### Error handling / retry
- background job heartbeat every 25s
- stale jobs >5 min marked failed
- safe DB wrapper returns `[]` on read failures
- email tokens refresh automatically
- drive tokens refresh automatically
- calendar tokens refresh inline
- LLM has cross-provider routing/fallback in `_shared/llm.ts`
- truncation retries: normal → compact → ultra-compact → deterministic fallback

### Rate-limit / timeout handling
- LLM router timeout override for `ceo-briefing`: 240s
- provider failover OpenAI/Claude
- no deep backoff queue for briefing itself
- Slack/email extraction failures mostly degrade to empty arrays rather than fail the briefing

### Logging/metrics available
- `ceo_briefing_jobs` status/progress/phase/error
- `ceo_briefings.payload.generation_meta`
- `payload.source_provenance`
- `payload.friction_meta`
- `payload.risk_reconciliation`
- `payload.decisions_meta`
- `sync_logs`
- integration table freshness markers

Observed observability weakness:
- `edge_function_logs` and analytics returned no recent logs for briefing/pulse functions during this audit, so debugging depends heavily on persisted payload metadata rather than runtime traces

---

## 7) Top 10 highest-impact fixes (impact vs effort)

1. **Expand real workstream coverage from 1/6 priorities to all 6**
   - Impact: extreme
   - Effort: medium

2. **Feed strategic documents into `project_files` at scale**
   - Impact: extreme
   - Effort: medium

3. **Wire Team Briefing to live Google Drive evidence instead of relying mainly on uploaded `project_files`**
   - Impact: very high
   - Effort: medium-high

4. **Get Slack bot into relevant channels so inbound pulse scans real conversations**
   - Impact: very high
   - Effort: low operational / medium coordination

5. **Add missing source domains now explicitly absent (`hubspot`, likely GitHub/product-engineering signals)**
   - Impact: very high
   - Effort: high

6. **Persist richer provenance and runtime logs for each briefing run**
   - Impact: high
   - Effort: low-medium

7. **Strengthen document-intelligence grounding beyond filename/title heuristics**
   - Impact: high
   - Effort: medium

8. **Replace sparse singleton/shared Drive token model with explicit evidence ingestion workflow**
   - Impact: high
   - Effort: medium

9. **Improve freshness surfacing per source directly in payload/UI**
   - Impact: medium-high
   - Effort: low

10. **Add clearer failure counters for email/slack/calendar token refresh and extraction degradation**
   - Impact: medium
   - Effort: low

---

## 8) Required 4–6 fixes for MVP readiness

These are the minimum blockers before Team Briefing can be considered MVP-ready as a reliable decision surface:

1. **Complete priority-to-workstream coverage**
2. **Populate strategic artifact evidence so confidence cap can move above low**
3. **Restore useful Slack inbound coverage (membership + scanable channels)**
4. **Make Google Drive evidence materially feed briefing scoring, not sit adjacent to it**
5. **Add at least one missing major commercial system now absent from the briefing evidence graph (HubSpot first)**
6. **Improve observability for why each run became low-confidence, degraded, or fallback**

---

## Bottom line
Team Briefing today is architecturally solid but evidence-starved. The system is already designed to be brutally honest: deterministic clamps, confidence caps, transcript-based untracked-signal detection, server-side company pulse, and fallback handling all work as intended. The low-confidence output is not mainly a model-quality problem. It is a source-coverage problem:
- too few mapped workstreams
- too few strategic artifacts
- almost no inbound Slack visibility
- no HubSpot/GitHub evidence
- Google Drive connected but not deeply feeding the briefing

That is why the latest briefing is correctly landing as low-evidence and Off Track.
