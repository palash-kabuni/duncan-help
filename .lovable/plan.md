

## Fix: Section 9 “Decisions the CEO Must Make” is empty

### Root cause

Point 09 is empty for the same structural reason Sections 6 and 8 were empty:

- The schema includes `payload.decisions[]`
- The prompt constrains the shape of each decision
- But the prompt never says **when decisions are mandatory**, **what sources must feed them**, or **what minimum count is required on a red briefing**
- There is **no deterministic post-processor** to inject decisions when the AI returns `[]`
- The UI renders the section with no empty-state explanation, so it just looks blank

Confirmed in the latest morning briefing:
- `outcome_probability = 30`
- `execution_score = 35`
- company pulse = Red
- multiple coverage gaps + watchlist rows + risks
- `payload.decisions = []`

That should never happen on a briefing this red.

### What Section 9 should contain

A Section 9 decision is not a generic recommendation. It should be a **real CEO-level call that only Nimesh can make or unblock**, such as:

- assign an owner to a silent 2026 priority
- decide whether to formalise an untracked but active priority into a workstream
- approve / reject a cross-functional escalation with no clear resolver
- force upload of missing artifacts before making a board-facing or launch-facing claim
- intervene where a silent leader owns a critical priority
- choose whether to proceed despite blind spots in legal / finance planning / technology direction

### Implementation plan

**1. Strengthen the briefing prompt in `supabase/functions/ceo-briefing/index.ts`**

Add explicit `payload.decisions` population rules in the morning schema rules block:

- decisions must be populated from:
  - `coverage_gaps`
  - `headline_context.silent_priorities`
  - high/critical `risks`
  - `friction` entries where `recommended_resolver = "CEO"`
  - `email_pulse_signals` escalations / board mentions / ownerless commitments
  - `data_coverage_audit` when confidence is capped low/medium
- each decision must describe:
  - the exact decision
  - why it matters
  - 7-day consequence of no decision
  - who the CEO must involve
  - confidence capped by `data_coverage_audit.confidence_cap`
  - `blocked_by_missing_data` when the decision is evidence-constrained
- add a minimum:
  - if trajectory is not green, or outcome probability < 70, or coverage gaps exist, `decisions[]` must contain at least 3 entries
- prioritize only **CEO-grade calls**, not operational tasks

**2. Add a deterministic Section 9 post-processor in `supabase/functions/ceo-briefing/index.ts`**

After the existing watchlist / risk / friction post-processing, add a decision floor that builds missing decisions from known signals.

Inject a decision when absent for:
- each silent / uncovered priority
  - e.g. “Assign accountable owner and stand up workstream for 1M registrations”
- each CEO-resolved friction item
  - e.g. “Break deadlock between Marketing and Operations on X”
- each severe blind spot blocking honest judgement
  - e.g. “Proceed with June 7 commitments or pause until missing India ops/legal artifacts are uploaded”
- each critical email escalation or board mention with no owner
- each silent leader owning a critical 2026 priority

Then:
- dedupe by normalized decision title / priority
- sort by urgency
- keep the top 3 strongest decisions for the UI
- stamp `auto_injected: true` on deterministic rows

**3. Extend the decisions schema slightly**

Update `payload.decisions[]` to include:
- `auto_injected: boolean`
- optional `evidence_source` such as:
  - `coverage_gap`
  - `risk`
  - `friction`
  - `email`
  - `silent_leader`
  - `data_blind_spot`

This makes the section auditable and consistent with the fixes already applied to friction/watchlist.

**4. Improve Section 9 rendering in `src/pages/CEOBriefing.tsx`**

Update the “Decisions the CEO Must Make” section to:
- show an explicit empty state when there are truly no CEO decisions on a green briefing
- visually distinguish auto-flagged decisions
- optionally show a small evidence/source chip
- keep the existing confidence badge and missing-data warning
- preserve the current top-3 card layout

### Files to edit

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Add payload.decisions population rules to MORNING_SCHEMA_HINT
  - Add deterministic decision post-processor
  - Add decision dedupe + urgency sort + top-3 normalization
  - Optionally extend decisions items with auto_injected + evidence_source

EDIT src/pages/CEOBriefing.tsx
  - Add empty state for Section 9
  - Add auto-flag styling / source chip for decisions
```

### Expected outcome

After this change, Point 09 will no longer go blank on red or low-confidence briefings.

For the current kind of briefing, Section 9 should surface decisions like:
- assign owners to silent 2026 priorities
- decide whether to proceed on June 7 with severe ops/legal blind spots
- resolve cross-functional escalations now rather than letting them drift
- intervene with silent leaders who own critical outcomes

### Out of scope

- Sending Section 9 decisions as standalone routed action emails
- “Mark decision taken” workflow / persistence
- Historical trend view of repeated CEO decisions across briefings

