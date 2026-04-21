

## Fix Coverage Detection + Honest Scoring When Workstreams Are Missing

### Two real bugs

**Bug 1 — False "all covered" green pill.** The coverage matcher in `ceo-briefing` is matching too loosely (e.g. "Lightning Strike Event" workstream is matching multiple priorities, or aliases overlap), so it reports 6/6 covered when in reality only 1 priority (Lightning Strike India) has a real workstream. The other 5 (KPL registrations, Trials, 10-team selection, Pre-orders, Duncan automation) have NO workstream — they should ALL be flagged as gaps.

**Bug 2 — Fabricated probability & execution scores.** The model returns `outcome_probability: 68` and `execution_score: 63` even when there are no workstreams to evidence those numbers. That's hallucination dressed as a metric. If 5 of 6 priorities have no workstream, Duncan cannot honestly claim 68% probability — it has no evidence base.

### What changes

**`supabase/functions/ceo-briefing/index.ts`**

1. **Rewrite `detectCoverage`** with strict matching rules:
   - Each priority must match against a **dedicated** workstream (1:1, not 1:many).
   - A workstream can only satisfy ONE priority (first-match-wins, then it's consumed).
   - Aliases must be specific, multi-word, lowercased substring matches against `project_tag` / `project_name` ONLY — NOT against card titles (card titles are too noisy and caused false positives).
   - Generic words ("event", "launch", "app") removed from alias lists — only distinctive phrases ("kpl registration", "pre-order", "10 team selection", "duncan automation", "trials").
   - Result: if only `Lightning Strike Event` workstream exists → coverage = 1/6, gaps = 5.

2. **Server-side enforcement of coverage_gaps**: after the AI returns its payload, override `payload.coverage_gaps` with the deterministic server-computed list (so the model can never claim "all covered" when it isn't). The model still writes `why_it_matters` / `consequence_if_unowned` per gap, but the LIST is server-truth.

3. **Honest scoring rule** — add to system prompt + enforce server-side:
   > "If `coverage_ratio < 0.5` (less than half of priorities have a workstream), `outcome_probability` MUST be ≤ 35 and `execution_score` MUST be ≤ 40, with `trajectory: 'Off Track'` or `'At Risk'`. Justify in `confidence_basis`: 'Low confidence — N of 6 priorities have no owned workstream.' You cannot project >35% probability against a plan you cannot see."
   
   Then server-side clamp: after AI response, if `coverage_ratio < 0.5`, force-cap `outcome_probability` and `execution_score` to those ceilings and append a `confidence_warning` field.

4. **Add `coverage_summary` to payload**: `{ covered: 1, total: 6, ratio: 0.17, missing_priorities: [...] }` so the UI can render it explicitly.

**`src/components/ceo/CoverageGaps.tsx`**

- Show coverage ratio in the header: *"Coverage Gaps — 5 of 6 priorities have NO workstream (17% covered)"*.
- Empty-state green pill only renders when `covered === total`, not when array happens to be empty for other reasons.

**`src/components/ceo/PulseBanner.tsx`**

- If `coverage_ratio < 0.5`, render a red banner above the gauges: *"⚠ Low-evidence briefing — Duncan can only see 1 of 6 priorities. Probability and execution scores are capped until missing workstreams are created."*
- Gauges visually de-emphasised (reduced opacity) when coverage is weak.

**`src/pages/CEOBriefing.tsx`**

- The "No workstreams configured" message currently shows even when workstreams DO exist — fix the condition to render only when `available_workstreams.length === 0` (genuine empty state), not when `workstream_scores.length === 0`. Two different things.

### Result for today's regenerate

```text
Coverage Gaps — 5 of 6 priorities have NO workstream (17% covered)
  • 1M KPL Registrations            → suggest Alex (CMO)  [Create workstream]
  • Trials Oct/Nov 2026             → suggest Matt (CPO)  [Create workstream]
  • 10-team Dec selection           → suggest Ellaine     [Create workstream]
  • 100k Pre-orders                 → suggest Alex (CMO)  [Create workstream]
  • Duncan automates 25%            → suggest Palash      [Create workstream]

⚠ Low-evidence briefing — Duncan can only see 1 of 6 priorities.
  Probability and execution capped until missing workstreams created.

Probability: 28%   Execution: 32%   Trajectory: At Risk
```

Honest, evidence-bound, and actionable.

### Files

```text
EDIT supabase/functions/ceo-briefing/index.ts
       - Rewrite detectCoverage (strict 1:1, project_tag/name only, no card titles)
       - Server-authoritative coverage_gaps (override AI output)
       - Honest-scoring clamp when coverage_ratio < 0.5
       - Add coverage_summary + confidence_warning to payload
EDIT src/components/ceo/CoverageGaps.tsx     (show ratio in header, fix empty-state)
EDIT src/components/ceo/PulseBanner.tsx      (low-evidence banner + de-emphasised gauges)
EDIT src/pages/CEOBriefing.tsx               (fix "no workstreams configured" condition)
EDIT mem://features/ceo-operating-system.md  (note honest-scoring + strict coverage rules)
```

### Out of scope

- Editable priority list (still hardcoded — `ceo_priorities` table is a future option).
- Auto-creating the missing workstreams without your approval.

