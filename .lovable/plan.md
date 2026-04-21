

## Surface Missing-but-Required Workstreams to the CEO

### The gap

Once we lock scoring to real workstreams (`K10 App`, `Website`, `Lightning Strike Event` + Azure projects), Duncan will silently ignore the **2026 priorities that have no workstream at all** — exactly the ones you most need flagged. E.g. if there's no workstream for "1M KPL registrations", "Pre-orders", "Trials", or "Duncan automation", the briefing will score what exists and stay quiet on the gaps.

That's the opposite of accountability.

### Fix: Coverage Gap detection

Treat the **6 non-negotiable 2026 priorities** as the canonical list Duncan must check coverage against. Any priority without a matching workstream becomes a flagged action item for the CEO.

```text
2026 PRIORITIES (canonical)              EXPECTED MATCH (project_tag / azure project)
1. Lightning Strike India 7 Jun 2026  →  "Lightning Strike Event"          ✅
2. 1M KPL registrations               →  ??? (no workstream)               ❌ GAP
3. Trials Oct/Nov 2026                →  ??? (no workstream)               ❌ GAP
4. 10-team Dec selection              →  ??? (no workstream)               ❌ GAP
5. 100k pre-orders                    →  ??? (no workstream)               ❌ GAP
6. Duncan automates 25%               →  ??? (no workstream)               ❌ GAP
```

### What changes

**`supabase/functions/ceo-briefing/index.ts`**

1. Define `PRIORITY_DEFINITIONS` constant: 6 priorities, each with `id`, `title`, `aliases[]` (matching keywords), `expected_owner`.
2. After loading `available_workstreams`, run a coverage match: for each priority, scan workstream names + Azure project names + recent card titles for any alias hit. Build `coverage_report = [{ priority, status: 'covered'|'missing', matched_workstream | null }]`.
3. Inject `coverage_report` and `priority_definitions` into the AI context.
4. Tighten prompt:
   > "For every priority where `coverage_report.status = 'missing'`, you MUST add an entry to `payload.coverage_gaps` with: `priority`, `why_it_matters`, `consequence_if_unowned`, `recommended_owner`, `recommended_workstream_name`. Do NOT fabricate scores for missing priorities — flag them instead. Brutal Truth must mention any uncovered priority."
5. Extend `MORNING_SCHEMA_HINT` with new top-level field:
   ```text
   coverage_gaps: [{ priority, why_it_matters, consequence_if_unowned, recommended_owner, recommended_workstream_name }]
   ```

**`src/components/ceo/CoverageGaps.tsx` (NEW)**

Red-bordered panel rendered prominently on `/ceo` directly under the TL;DR. For each gap: priority title, why it matters, consequence, suggested owner, and a **"Create workstream"** button that deep-links to `/workstreams` with the recommended `project_tag` pre-filled (URL param). One click → the gap becomes a tracked workstream in the next briefing.

**`src/pages/CEOBriefing.tsx`**

Render `<CoverageGaps gaps={briefing.payload.coverage_gaps} />` between TL;DR and Pulse. If `coverage_gaps.length === 0`, show a small green "All 6 priorities covered" pill instead.

**`src/pages/Workstreams.tsx`**

Read `?prefill_tag=<name>&prefill_priority=<id>` from URL on mount. If present, auto-open the Create Card dialog with the `project_tag` field populated — so creating the workstream from a CEO gap takes one click.

### UI placement on `/ceo`

```text
┌────────────────────────────────────────────────┐
│ TL;DR (3 questions)                            │
├────────────────────────────────────────────────┤
│ ⚠ COVERAGE GAPS — 4 of 6 priorities have no   │
│   workstream:                                  │
│   • 1M KPL Registrations  → suggest Alex (CMO) │
│     [Create workstream]                        │
│   • 100k Pre-orders       → suggest Alex (CMO) │
│     [Create workstream]                        │
│   ...                                          │
├────────────────────────────────────────────────┤
│ Company Pulse · Probability · Exec Score       │
│ Workstream Scorecard (only real ones)          │
│ ...rest of briefing...                         │
└────────────────────────────────────────────────┘
```

### Files

```text
EDIT  supabase/functions/ceo-briefing/index.ts
        - Add PRIORITY_DEFINITIONS + coverage_report logic
        - Tighten prompt (no fabrication, mandatory coverage_gaps)
        - Extend MORNING_SCHEMA_HINT
EDIT  src/pages/CEOBriefing.tsx           (render CoverageGaps panel)
NEW   src/components/ceo/CoverageGaps.tsx
EDIT  src/pages/Workstreams.tsx           (read ?prefill_tag URL param)
EDIT  mem://features/ceo-operating-system.md  (note coverage-gap mechanic)
```

### Combined with the previous fix

This plan **bundles** the prior "Score Real Workstreams" fix — both ship together so today's regenerated briefing simultaneously:
- Stops fabricating workstreams
- Scores only K10 App / Website / Lightning Strike Event (+ Azure projects)
- **Surfaces every uncovered 2026 priority as an actionable gap with a one-click create button**

### Out of scope (ask if you want)

- Auto-create the missing workstreams without your approval
- Slack DM to suggested owner ("Alex — CEO has flagged you should own KPL Registrations workstream")
- Editable priority list (currently hardcoded; could become a `ceo_priorities` table)

