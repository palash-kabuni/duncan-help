

## Why "At Risk" wraps differently from the other sections

### What's actually happening

At 769px (your iPad viewport), the **At Risk** card header wraps the badges (`−12 pts`, `HIGH`, `conf 70%`) below the title. None of the other sections (Decisions, Workstream Scorecard, Leadership, etc.) do this — because none of them have the same header structure.

The current `RiskRadar.tsx` uses `lg:flex-row` (≥1024px) as the breakpoint where the title and badges sit side-by-side. At 769px we're below `lg`, so it stacks. That stacking is intentional from the last fix — but it's overkill, because the badges are short and easily fit next to the title at 769px.

The other sections don't show this behaviour because:
- **CEO Decisions** uses `flex-col sm:flex-row` (≥640px) — so badges sit inline at 769px
- **Workstream Scorecard** is a horizontally-scrollable table — no wrapping
- **Leadership Performance** is a grid of cards with no inline badge row
- **Pulse / Gauges** stack until `xl:` but that's a different layout problem (gauges are wide)

So At Risk is the odd one out because it jumped from `lg:` while the rest of the briefing uses `sm:` or `md:` for similar header patterns.

### Fix

Align the At Risk card header with the rest of the briefing: switch the breakpoint from `lg:` → `sm:` so the title and badges sit on one row from 640px upwards, matching CEO Decisions.

### Files to edit

```text
EDIT src/components/ceo/RiskRadar.tsx
  - Risk header container: lg:flex-row → sm:flex-row
  - lg:items-start, lg:justify-between, lg:gap-4 → sm: equivalents
  - Title: lg:flex-1 → sm:flex-1
  - Badge row: lg:shrink-0 lg:justify-end → sm:shrink-0 sm:justify-end
```

No other components change. Reconciliation banner and impact grid already wrap correctly.

### Out of scope

- Restructuring other section headers (they're already consistent)
- Changing what counts as a risk or how severity is assigned

