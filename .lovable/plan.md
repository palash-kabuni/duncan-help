

## Fix: Domain status must reflect strategic completeness, not just "any signal"

### What's wrong today

`computeDataCoverage` in `supabase/functions/ceo-briefing/index.ts` grades every domain on a single shallow rule:

- **Operations** → Green if *any* workstream/Azure/meeting activity exists in 24h.
- **Finance — Transactions** → Green if Xero is syncing.
- **Recruitment** → Green if any candidate moved.
- File-based domains (Legal, Tech Direction, Product, Investor) → Green if ≥2 filename aliases match.

So the dashboard says *"Operations: Green"* even when the entire 2026 strategy (Lightning Strike India, KPL 1M registrations, October trials, December selection, 100k pre-orders, Duncan 25% automation) has **no India launch runbook, no trials operations plan, no supply-chain readiness doc, no event ops manual, no escalation matrix uploaded**. Green is lying.

The user's diagnosis is right: status must be **gap-against-strategy**, not "is there a heartbeat."

### The fix — Strategy-anchored coverage scoring

**1. Define a "Strategic Artifact Requirement" per priority × domain**

For each of the 6 PRIORITY_DEFINITIONS already in the file, declare the documents/data feeds Duncan *must* see in each domain to give honest advice. Example:

```text
PRIORITY: Lightning Strike India — 7 June 2026
  operations:        India launch runbook, on-ground ops plan,
                     supply-chain readiness, event-day escalation matrix
  finance_planning:  Launch P&L, India landed-cost model, FX hedge plan
  legal:             India entity docs, vendor MoU, data-residency review,
                     event insurance, regulatory licences
  technology:        Launch-day infra capacity plan, India CDN/edge plan,
                     incident runbook
  product:           Launch SKU spec, packaging artwork sign-off
  investor_board:    Launch-readiness board memo

PRIORITY: 1M KPL registrations
  operations:        Registration funnel ops plan, support staffing model
  finance_planning:  CAC budget by channel, paid-media forecast
  ...

(repeat for trials, team_selection, preorders, duncan_automation)
```

This is the **denominator**. Today there's only a numerator ("any file matched") with no denominator, which is why everything trends Green.

**2. New scoring rule per domain**

```text
required  = sum of strategic artifacts mapped to this domain across all 6 priorities
supplied  = artifacts evidenced by:
              - filename match (existing logic)
              - meeting title match
              - workstream card title match for that artifact
              - Azure work item title match
coverage% = supplied / required

status:
  >= 70%  → green
  40-69%  → yellow
  <  40%  → red

PLUS: any priority with 0 supplied artifacts in a critical domain
      (operations / finance_planning / legal / technology) forces that
      domain to RED regardless of % — because a single uncovered priority
      is a strategic blind spot.
```

So Operations stops being Green just because Simon closed three cards. It's Green only when the operational artifacts behind the **2026 annual strategy** are demonstrably present.

**3. Per-priority gap surfacing (the list the user asked for)**

The audit returns a new structure consumed by `DataCoverageCard`:

```text
strategic_coverage: [
  {
    priority_id: "lightning_strike",
    priority_title: "Lightning Strike India — 7 June 2026",
    coverage_pct: 22,
    status: "red",
    by_domain: [
      {
        domain: "operations",
        required: ["India launch runbook", "On-ground ops plan",
                   "Supply-chain readiness", "Escalation matrix"],
        supplied: [],
        missing: ["India launch runbook", "On-ground ops plan",
                  "Supply-chain readiness", "Escalation matrix"],
      },
      { domain: "legal", required: [...], supplied: ["NDA register"],
        missing: ["India entity docs", "Vendor MoU", "Data-residency review",
                  "Event insurance"] },
      ...
    ]
  },
  ...
]
```

This is the **explicit "files we still need" list grouped by 2026 priority** — not just by domain.

**4. Domain card now shows strategic gap, not heartbeat**

```text
Operations            🔴  Red          (was: 🟢 Green)
  Strategic coverage: 1 / 11 artifacts (9%)
  Blind for: Lightning Strike, Trials, Team Selection
  Missing: India launch runbook, Trials ops plan, Selection-day runbook,
           Supply-chain readiness, Escalation matrix, Support staffing
           model, Event-day incident plan, ...
  [Upload to fix]
```

Heartbeat data (workstreams active, Azure synced, meetings logged) is shown as a separate **"Live signal: active"** chip — useful, but it no longer flips status to Green by itself.

**5. Predicted-vs-supplied (the user's "predict what we have" ask)**

For each required artifact, run the existing fuzzy match across `project_files`, `workstream_cards`, `azure_work_items`, `meetings`, `xero_invoices`. If a near-match exists, mark `likely_supplied_as: "Lightning Strike Vendor Note v2.docx"` so the CEO sees: *"You probably have this — confirm it's the right doc"* vs *"Genuinely missing."* This stops false negatives where Patrick uploaded the right file under a slightly different name.

**6. Confidence cap recomputed from strategic coverage**

```text
overall_strategic_coverage = average(coverage_pct across 6 priorities)
  >= 70%  → cap = high
  40-69%  → cap = medium
  <  40%  → cap = low
```

The existing red-count cap stays as a floor — whichever is stricter wins.

### Files to edit

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Add STRATEGIC_ARTIFACT_MATRIX[priority_id][domain_id] = string[]
    covering all 6 PRIORITY_DEFINITIONS × 7 KNOWLEDGE_DOMAINS
  - Rewrite computeDataCoverage:
      • For each domain, score against required artifacts (not just any signal)
      • Match supplied artifacts across project_files + workstream_cards +
        azure_work_items + meetings + xero_invoices titles
      • Apply >=70 / 40-69 / <40 thresholds + critical-priority floor rule
      • Return new strategic_coverage[] structure (per-priority, per-domain,
        with required / supplied / missing / likely_supplied_as)
      • Recompute confidence_cap from strategic coverage average
  - Inject strategic_coverage into AI context so prompt rules can cite it
  - Schema += payload.data_coverage_audit.strategic_coverage[]

EDIT src/components/ceo/DataCoverageCard.tsx
  - Domain row now shows "X / Y artifacts (Z%)" + which priorities it's blind for
  - Add expandable "Files we still need" list per priority (grouped by domain)
  - "Live signal: active/quiet" chip rendered separately from status dot
  - Reuse existing prefill_tag deep-link for one-click upload

EDIT src/pages/CEOBriefing.tsx
  - Pass strategic_coverage prop through to DataCoverageCard
```

### Outcome

- Operations stops appearing Green just because there's daily noise — it goes Red until the **strategic artifacts behind the 2026 plan** are actually in the system.
- The CEO sees a concrete shopping list grouped by priority: *"Lightning Strike is 22% covered — here are the 9 files we still don't have."*
- Confidence cap, watchlist blind spots, and Decisions §9 blockers all inherit the new strategic-gap math automatically (no extra wiring — they already read from `data_coverage_audit`).

### Out of scope (ask if you want)

- Letting an admin edit `STRATEGIC_ARTIFACT_MATRIX` from the UI rather than from code
- Auto-creating a workstream card per missing strategic artifact, owned by the priority's `expected_owner`
- Weekly digest of strategic-coverage delta (*"this week: +3 artifacts, India launch up to 31%"*)

