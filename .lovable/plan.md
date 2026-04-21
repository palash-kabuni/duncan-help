

## Trim duplicated UI in the CEO Briefing (no data changes)

You're right — the morning briefing currently shows the same numbers and narrative two or three times before you even reach Section 04. Below is what's repeated and what to remove. **No data points, schema, or briefing logic change.** Only redundant render blocks are deleted.

### What's duplicated today

Order on screen right now:

```text
PulseBanner               → Trajectory + Probability gauge + Execution gauge + low-evidence warning
TldrPanel                 → AI tl;dr
CoverageGaps              → Coverage summary + gaps
CompanyPulseCard          → Company status + reason + evidence + blockers
EmailPulseCard
DataCoverageCard
01 Company Pulse — Narrative   ← duplicates CompanyPulseCard.reason
02 Outcome Probability — June 7 ← duplicates PulseBanner Probability gauge
03 Execution Score              ← duplicates PulseBanner Execution gauge
04 What Changed Yesterday
…
```

So Probability appears in **PulseBanner + Section 02**, Execution appears in **PulseBanner + Section 03**, and the Company Pulse narrative appears in **CompanyPulseCard + Section 01**. That's the "01, 02, 03 double-up" you're seeing.

### Cleanup (UI only)

1. **Remove Section 01 "Company Pulse — Narrative"** — `CompanyPulseCard` already renders `pulse.reason` + evidence + blockers + positives. The standalone `<p>{p.company_pulse}</p>` adds nothing.

2. **Remove Section 02 "Outcome Probability — June 7"** as a standalone card. The big gauge in `PulseBanner` already shows the % and delta. Move the one line of `probability_movement` context into a small caption directly under the PulseBanner gauges so the "why it moved" sentence isn't lost.

3. **Remove Section 03 "Execution Score"** as a standalone card. Same reason — the Execution gauge is already in `PulseBanner`. Move `execution_explanation` into the same caption row under the gauges.

4. **Renumber the remaining sections** so the CEO sees a clean 01–08 instead of 04–11:

```text
Before                              After
04 What Changed Yesterday      →    01 What Changed Yesterday
05 Strategic Risk Radar        →    02 Strategic Risk Radar
06 Cross-Functional Friction   →    03 Cross-Functional Friction
07 Leadership Performance      →    04 Leadership Performance
08 Accountability Watchlist    →    05 Accountability Watchlist
09 Decisions the CEO Must Make →    06 Decisions the CEO Must Make
10 Automation Progress         →    07 Automation Progress
11 One Brutal Truth            →    08 One Brutal Truth
```

The "Workstream Scorecard" section currently uses `n={0}` (renders as `00`) — keep it as a labelled block but drop the `00` prefix so it reads cleanly between the top cards and Section 01.

5. **Evening tab is already clean** (1–6, no duplicates). No changes there.

### What stays exactly the same

- All data fetched, scored, and stored
- PulseBanner, TldrPanel, CoverageGaps, CompanyPulseCard, EmailPulseCard, DataCoverageCard
- Workstream Scorecard table
- All sections from "What Changed Yesterday" onward — same content, same components, just renumbered
- `ceo-briefing` edge function — untouched

### Files to edit

```text
EDIT src/pages/CEOBriefing.tsx
  - Delete <Section n={1} title="Company Pulse — Narrative">
  - Delete <Section n={2} title="Outcome Probability — June 7">
  - Delete <Section n={3} title="Execution Score">
  - Renumber remaining morning sections 4→1, 5→2, 6→3, 7→4, 8→5, 9→6, 10→7, 11→8
  - Workstream Scorecard: render heading without the "00 ·" prefix
    (small custom heading instead of <Section n={0}>)

EDIT src/components/ceo/PulseBanner.tsx
  - Accept two new optional props: probabilityMovement, executionExplanation
  - Render them as a small two-column caption row under the gauges
    (only shown when present), so the context that lived in Sections
    02 and 03 stays visible directly beside the numbers
```

### Outcome

- Three redundant blocks (~one full screen of repeated content) gone from the top of the morning briefing.
- Probability % and Execution score appear **once**, with their explanatory sentence directly underneath the gauge.
- Section numbers run 01–08 in a single clean sequence instead of jumping from 00 → 11.
- Zero changes to the underlying briefing payload, prompt, or post-processors.

### Out of scope (ask if you want)

- Collapsing `EmailPulseCard` and `DataCoverageCard` into a single "Signals" row
- Making the Workstream Scorecard collapsible by default
- Same dedupe pass on the evening briefing (currently already clean)

