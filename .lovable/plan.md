

## Fix: Risk Radar must reconcile with the headline 35% / 49% scores

### What's wrong

Headline scores and the Risk Radar are computed by two unrelated paths:

- **Headline** — `outcome_probability` (35%) and `execution_score` (49%) are produced from deterministic inputs: workstream coverage, silent priorities, integration health, confidence cap.
- **Risk Radar (Section 5)** — `payload.risks[]` is free-form AI output with its own `severity` and `confidence` per risk. The prompt never tells the model: *"these risks must be the reasons probability is 35% and execution is 49%."*

Result: the headline says *"India launch is at 35% probability — that's red"* but the Risk Radar shows two yellow medium-severity risks. They look like they belong to different briefings.

### The fix — Make Risk Radar a forced explanation of the headline

**1. Inject the headline into the Risk Radar prompt as a hard constraint**

Before risks are generated, the function already knows `outcome_probability`, `execution_score`, `silentMissing`, `failedSyncs`, `criticalIssues`, `overdueFinance`. Inject these as `HEADLINE_CONTEXT` and require:

```text
HEADLINE_CONTEXT (June 7 readiness)
  outcome_probability: 35   (RED — anything <50 is red)
  execution_score:     49   (RED — anything <60 is red)
  silent_priorities:   ["Trials Ops", "Team Selection"]
  failed_syncs_24h:    1
  critical_issues:     2
  overdue_finance:     0

RULES for risks[]:
  • The risks array MUST collectively explain why probability=35 and
    execution=49. If you cannot justify the gap from 100 to 35 (i.e.
    65 points of probability lost) with the listed risks, you have
    missed risks — add them.
  • At least one risk MUST be tagged severity:"critical" or "high"
    whenever outcome_probability < 50 OR execution_score < 60.
  • Every silent_priority MUST appear as its own risk with
    severity:"high" minimum.
  • Each risk gets a new field:
        probability_impact_pts: number   // how many pts of the 65-pt
                                         // gap this risk accounts for
    Sum of probability_impact_pts across all risks must be within
    ±10 of (100 - outcome_probability).
```

**2. Deterministic floor — don't trust the model alone**

Post-process the AI output:

- If `outcome_probability < 50` and no risk has `severity ∈ {critical, high}`, **upgrade the top risk** to `high` and append a system-generated risk: *"Outcome probability is 35% — the listed risks under-explain the gap. Verify with owners before board sign-off."*
- For every entry in `silentMissing`, if no risk mentions that priority by name, **inject a synthetic risk**: `severity: "high"`, `risk: "<priority> is silent — no meetings, no workstreams, no owner activity in 7d"`, `probability_impact_pts: 15`.
- Normalize `probability_impact_pts` so the visible total matches the headline gap.

**3. UI: show the reconciliation explicitly**

```text
EDIT src/components/ceo/RiskRadar.tsx
  - New header strip above the risk list:
      "Probability 35% · Execution 49%
       The risks below account for 62 of the 65 lost probability points."
  - Each risk card shows a small chip:
      "−15 pts probability"   (from probability_impact_pts)
  - If the post-processor injected a synthetic risk, render it with
    a dashed border and a "Auto-flagged from headline" tag so the CEO
    knows it's a system insertion, not model judgement.
  - Sort risks by probability_impact_pts DESC (biggest contributors first).
```

**4. Schema additions**

```text
Risk += probability_impact_pts: number
payload += risk_reconciliation: {
  probability_gap: number,         // 100 - outcome_probability
  accounted_for_pts: number,       // sum of probability_impact_pts
  unexplained_pts: number,         // gap - accounted_for_pts
  auto_injected_count: number
}
```

`unexplained_pts > 10` triggers a visible amber warning in the header strip — *"3 pts of risk not explained — Duncan may be missing a risk."*

### Files to edit

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Compute HEADLINE_CONTEXT before the AI call and inject into prompt
  - Add probability_impact_pts to risks[] schema + reconciliation rules
  - Post-processor:
      • Upgrade top risk severity if headline is red but risks aren't
      • Inject synthetic risks for silent priorities
      • Compute risk_reconciliation summary
      • Normalize probability_impact_pts to match headline gap

EDIT src/components/ceo/RiskRadar.tsx
  - Accept new reconciliation prop
  - Render header reconciliation strip
  - Per-risk "−N pts" chip
  - Dashed border + "Auto-flagged" tag for synthetic risks
  - Sort by probability_impact_pts DESC

EDIT src/pages/CEOBriefing.tsx
  - Pass p.risk_reconciliation into <RiskRadar />
```

### Outcome

- The Risk Radar can no longer drift from the headline. If probability is 35%, the radar will show risks whose combined `probability_impact_pts` add up to ~65, with at least one critical/high severity entry.
- Silent priorities (the biggest cause of low scores) will always appear as risks — currently they're invisible in Section 5.
- The CEO sees one coherent story: *"Probability 35% because of these 5 risks worth 62 pts; 3 pts unexplained — investigate."*

### Out of scope (ask if you want)

- Same reconciliation applied to `execution_score` (e.g. each Leadership Performance card contributes execution-impact-pts that must sum to 100 − execution_score)
- Per-risk one-click "Send to owner" using the existing `send-ceo-briefing-actions` function
- Trend chart of `unexplained_pts` over the last 14 briefings to spot when Duncan's risk model starts diverging from the data

