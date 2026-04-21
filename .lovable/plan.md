

## Make Duncan Honest About What It Cannot See — Data Coverage Audit

Right now Duncan grades the company on the data it *has* (workstreams, Azure cards, meetings). It never says **"I'm flying blind on finance, legal, NDAs and tech direction."** That's why the briefing feels operational — because it *is* operational. We'll fix that by adding a **Data Coverage Audit** — a self-aware layer where Duncan declares, every briefing, what data domains it can and cannot see, and downgrades its own confidence accordingly.

### What changes

**A new section on the CEO Briefing called "What Duncan Can't See"** sitting next to the Company Pulse. It lists the data domains Duncan needs in order to give an honest verdict, marks each as connected / partial / missing, and explains what that means for the briefing's reliability.

Example:

```text
WHAT DUNCAN CAN'T SEE — confidence cap: medium

🟢 Operations            workstreams, Azure DevOps, meetings — current
🟢 Recruitment           Hireflix, candidate scoring — current
🟡 Finance               Xero invoices/contacts only · NO budget vs actual,
                         NO cash runway, NO financial plan document
🔴 Legal & Compliance    NO contracts, NO NDAs, NO IP register
🔴 Technology direction  Azure work items only · NO architecture docs,
                         NO roadmap, NO release-readiness signal
🔴 Investor / Board      NO board pack, NO investor updates, NO KPI deck
🟡 Product strategy      Workstream tags only · NO PRDs, NO roadmap,
                         NO customer research

Because of these gaps Duncan cannot honestly judge:
- Is the company financially on track for June 7?  → unknown
- Is Kabuni's technology heading the right way?    → unknown
- Are legal commitments protecting the launch?     → unknown
```

This forces Duncan to behave like a real Chief of Staff: name what's missing, refuse to fake confidence on it, and tell the CEO exactly which document or integration to upload to fix the blind spot.

### Status rules (deterministic, server-side)

For each **knowledge domain** we declare a required signal set. A domain is:

- **Green** if at least one strong signal source is connected and recently updated
- **Yellow** if partial (e.g. transactional Xero data only, no plan to compare against)
- **Red** if no signal source at all

The 7 domains tracked:

```text
operations           workstream_cards, azure_work_items, meetings
recruitment          candidates table activity
finance_transactions xero_invoices, xero_contacts
finance_planning     project_files tagged "finance plan" / "budget" / "forecast"
legal                project_files tagged "contract" / "nda" / "ip"
technology_direction project_files tagged "architecture" / "roadmap" / "tech plan"
                     + recent releases + Azure milestones
product_strategy     project_files tagged "prd" / "roadmap" / "research"
investor_board       project_files tagged "board" / "investor update" / "kpi deck"
```

Detection uses a simple, deterministic scan of `project_files.file_name` (and `meetings.title`) for keyword aliases — same pattern already used for priority detection. No AI inference, so it cannot lie.

### Confidence cap

If any domain critical to the 6 priorities is **Red**, the briefing's overall confidence is capped:

- ≥1 Red critical domain → confidence cap = **medium**
- ≥3 Red domains OR finance_planning + technology_direction both Red → cap = **low**

This stacks with the existing coverage cap (probability ≤35 if <50% workstream coverage). Duncan literally cannot project a high probability on a plan it has never been allowed to read.

### Recommendations

For every Red/Yellow domain, the briefing emits an actionable upload prompt:

```text
🔴 Legal & Compliance
   Upload to /projects: signed Lightning Strike vendor contracts,
   any active NDAs, IP register. Without these Duncan cannot warn
   you about expiring obligations or unsigned commitments.

🔴 Technology direction
   Upload to /projects: current architecture diagram, 2026 tech
   roadmap, release readiness checklist. Without these Duncan can
   only see ticket motion, not whether the platform is heading the
   right way.
```

These are formatted as one-click actions in the UI (link to `/projects` with a `prefill_tag` query param so the CEO can drop the file straight in).

### Wired into the existing briefing

The new audit affects three existing fields so the briefing tells one coherent story:

1. **`payload.company_pulse_status.evidence`** gets a "Data blind spots: X red, Y yellow" line
2. **`payload.brutal_truth`** must mention the worst Red domain by name
3. **`payload.tldr.where_to_act`** includes the top upload recommendation if any Red domain is critical

### UI

```text
CEOBriefing.tsx
├── PulseBanner          (Lightning Strike trajectory — unchanged)
├── CompanyPulseCard     (RYG — unchanged)
├── DataCoverageCard ◄── NEW
│      • 7 domains with R/Y/G dots
│      • "Confidence cap" badge
│      • Per-domain "Upload to fix" buttons
├── CoverageGaps         (workstream gaps — unchanged)
├── RiskRadar
└── …
```

### Files

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Add KNOWLEDGE_DOMAINS constant (7 domains + aliases + critical flag)
  - Pull project_files (file_name, project_id) into context
  - Add computeDataCoverage() — deterministic, like detectCoverage()
  - Inject payload.data_coverage_audit (status per domain, evidence,
    recommendations, confidence_cap)
  - Apply confidence cap to outcome_probability / execution_score
  - Force brutal_truth / tldr.where_to_act to mention worst Red domain

NEW src/components/ceo/DataCoverageCard.tsx
  - Render the 7 domains as a compact RYG grid
  - Per-domain expandable row with reason + upload CTA → /projects
  - Top-line "Confidence cap: high / medium / low" badge

EDIT src/pages/CEOBriefing.tsx
  - Mount <DataCoverageCard /> beneath <CompanyPulseCard />

EDIT mem://features/ceo-operating-system.md
  - Document the Data Coverage Audit, the 7 domains, and the
    confidence-cap rules
```

### Outcome

After this:

- Duncan **declares its blind spots** every briefing instead of pretending operations data is the whole picture
- The CEO sees **exactly which documents/integrations** to upload to make Duncan smarter
- A briefing that lacks finance plan, legal docs and tech roadmap **cannot** silently project high confidence — the cap is enforced server-side
- "Is Kabuni's technology heading the right way?" becomes a question Duncan either answers (because architecture/roadmap docs exist) or honestly refuses to answer (because they don't)

### Out of scope (ask if you want any of these)

- Auto-ingesting Google Drive folders into `/projects` so domain coverage fills itself
- Slack-channel scanning for legal/finance signals
- A separate "Documents Health" page showing freshness per domain (last update, owner, expiry)
- Auto-emailing the right exec when their domain is Red ("Patrick — Duncan needs the financial plan")

