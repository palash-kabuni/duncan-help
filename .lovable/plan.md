

## Make "What Duncan Can't See" prescriptive — not just descriptive

Right now the Data Coverage Audit tells the CEO **what's missing in broad strokes** ("Legal: Red"). It doesn't think like a Chief of Staff and say *"to give you board-grade advice on India launch, I need: signed MoU with vendor, indemnity clause review, data-residency confirmation, and Q2 cash-flow forecast — none of which are in your current uploads."*

The fix: turn the audit from a **status board** into a **shopping list**. Duncan reasons across every domain (not just the Red ones) and recommends the specific documents/data feeds it needs to operate at full strength — including things a CEO wouldn't think to upload.

### What changes

**1. New AI output: `payload.missing_artifacts_recommendations`**

Per knowledge domain (all 7, not just Red), Duncan returns a ranked shopping list:

```text
{
  domain: "legal",
  priority: "critical" | "high" | "medium" | "low",
  artifacts: [
    {
      name: "Signed India vendor MoU",
      why_duncan_needs_it: "Cannot judge launch risk without contractual scope, exit clauses, IP ownership",
      what_it_unlocks: "Risk Radar accuracy on India launch; Decisions §9 confidence cap → high",
      where_to_find_it: "Likely in DocuSign / Patrick's email / shared Drive Legal folder",
      suggested_filename_pattern: "india_vendor_mou_signed_v*.pdf",
      blast_radius: ["india_launch", "investor_update_q2", "board_pack"]
    },
    ...
  ]
}
```

**2. Forced "thinking beyond the CEO" rule in the prompt**

The model is explicitly instructed to recommend artifacts the CEO would not naturally think to upload, drawn from a baseline operating-system checklist:

```text
Finance:        13-week cash forecast, runway model, unit economics by SKU,
                CAC/LTV trend, AR aging, payroll forecast, FX exposure
Legal:          Cap table, shareholder agreement, IP assignments, employment
                contracts, supplier MSAs, NDAs (signed), data-processing
                agreements, regulatory licences, insurance certificates
Tech direction: Architecture decision records (ADRs), security audit,
                penetration test report, SLA register, vendor risk register,
                incident post-mortems, API contracts, infrastructure cost map
Product:        Roadmap with dated milestones, customer-research synthesis,
                churn analysis, feature-usage telemetry, NPS report
Investor/Board: Latest board deck, investor update emails, KPI dashboard
                snapshots, capital strategy memo, term sheet, 409A
People/Ops:     Org chart with comp bands, succession plan, performance
                calibration grid, hiring plan vs actual, attrition log
Strategy:       2026 OKRs signed off, competitor teardown, market sizing,
                pricing strategy, partnership pipeline
```

A green domain isn't off the hook — Duncan still says *"you have a finance plan, but you're missing a 13-week cash forecast and AR aging — without those, my runway calls are educated guesses."*

**3. Cross-system inference (think like a Chief of Staff)**

Duncan correlates what it sees in OTHER systems to deduce what should exist as a document:

- Saw in `meetings`: *"discussed India launch with Patrick"* → infers a vendor MoU/term sheet should exist → recommends upload.
- Saw in `xero_invoices`: large recurring payment to AWS → infers an infrastructure cost map / vendor contract should exist.
- Saw in `azure_work_items`: security tag on tickets → infers a pen-test report and security audit should exist.
- Saw in `recent_releases`: customer-facing feature → infers a customer-research synthesis should exist.

These inferences become recommendations with `where_to_find_it` populated from the source signal (*"Heard mentioned in Patrick's 14 Apr meeting — likely in his Drive folder"*).

**4. Unlock-value scoring**

Every artifact carries `what_it_unlocks` — the concrete sections of the briefing that go from *guess* to *grounded* once supplied. CEO sees: *"Upload the cap table → unlocks investor advisory + decision §9 confidence cap → high."* This is the difference between "you're missing things" and "uploading **this one file** raises Duncan's confidence on **these three sections**."

**5. UI: a new prescriptive card under the audit**

```text
EDIT src/components/ceo/DataCoverageCard.tsx
  - Below the domain list, add "Files Duncan is asking for"
    grouped by priority (critical → high → medium → low)
  - Each card: name + why_duncan_needs_it + what_it_unlocks +
    where_to_find_it (italic muted) + "Upload" button
    (deep-links to /projects?prefill_tag=<domain>&suggested_name=<pattern>)
  - Top counter: "12 files would unlock board-grade advice ·
    3 critical · 5 high · 4 medium"
```

**6. Decisions §9 inherits the recommendations**

When a decision is `blocked_by_missing_data`, the amber banner now lists the **specific files** Duncan needs (not just the domain): *"Decide blind — needs: Signed India vendor MoU, Q2 cash forecast, indemnity review."* Each is a one-click upload link.

### Files to edit

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Add OPERATING_SYSTEM_CHECKLIST constant (per-domain artifact baseline)
  - Inject checklist + cross-system signals (meetings/xero/azure/releases)
    into context as `inferred_artifact_signals`
  - Schema += payload.missing_artifacts_recommendations[]
  - Prompt rules:
      • Recommend artifacts even for GREEN domains (depth, not just presence)
      • Cross-reference meeting transcripts / Xero / Azure / releases
        to infer artifacts that SHOULD exist but haven't been uploaded
      • Each recommendation must have what_it_unlocks tied to a specific
        briefing section (Risk Radar / Decisions §N / Investor section / etc)
      • Maximum 15 recommendations total, ranked by unlock-value
  - Rewrite decisions[].blocked_by_missing_data to include specific
    artifact names (not just domain), pulled from recommendations

EDIT src/components/ceo/DataCoverageCard.tsx
  - New "Files Duncan is asking for" section grouped by priority
  - Per-artifact card with why / unlocks / where-to-find + Upload CTA
  - Top counter (total + per-priority breakdown)

EDIT src/pages/CEOBriefing.tsx
  - Decisions §9: blind banner lists specific artifacts (not just domain)
    with one-click upload links per file
```

### Outcome

- Duncan stops grading what's uploaded and starts **prescribing what should be**.
- The CEO sees a ranked shopping list of documents that, once supplied, measurably raise the briefing's confidence — with an explicit map of *which sections* each file unlocks.
- Missing things the CEO would never think to ask for (ADRs, 13-week cash forecast, cap table, vendor risk register) get surfaced because Duncan reasons from a Chief-of-Staff baseline, not from what's already in the system.
- Decisions §9 stops saying "blocked by Legal" and starts saying *"blocked by: Signed India vendor MoU + Q2 cash forecast — upload here."*

### Out of scope (ask if you want)

- Auto-emailing the likely owner of each missing artifact (Patrick for cap table, Nimesh for finance forecast) via existing `send-ceo-briefing-actions` routing
- Persisting recommendations across briefings so Duncan can show *"3 of 12 critical files supplied this week"* progress
- Auto-scanning Google Drive / DocuSign for filename matches and offering one-click ingest instead of manual upload

