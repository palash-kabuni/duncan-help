

## Workstream Scorecard is under-reporting and mis-scoring

### What I found

Latest morning briefing (2026-04-21):

- `available_workstreams` lists **6** workstreams: `K10 App`, `Lightning Strike Event`, `Website`, `duncan`, `kabuni-helpdesk`, `kabuni-mvp`
- `workstream_scores` contains **only 1** row (`Lightning Strike Event`)
- Brief-level signals say it's bad: `trajectory = "At Risk"`, `outcome_probability = 30`, `execution_score = 35`
- But the single scored workstream reads: `progress 60 / confidence 70 / risk 40` — i.e. essentially Green
- Underlying `workstream_cards` show all 3 active cards are `amber` (Yellow)

So the scorecard is wrong on three independent axes:

1. **Coverage** — the model ignores 5 of 6 workstreams instead of scoring all of them.
2. **Direction** — when the overall briefing is At Risk / 30% / 35, no scored workstream may sit in green territory without an evidenced reason. The current row shows 60/70/40 with prose like "Moderate progress" — that contradicts both the overall scores AND the underlying `amber` card status.
3. **No RAG field** — rows are missing a `rag` value, so downstream logic (watchlist auto-injection, UI colour) can't classify them. The watchlist deterministic floor in the edge function explicitly looks at `ws.rag` to decide whether to inject a row, so missing/blank RAG silently breaks accountability rules too.

The schema rules in `MORNING_SCHEMA_HINT` already require all 6 framework axes per row, but the rules don't:
- force one row per `available_workstreams` entry,
- require a `rag` field,
- reconcile workstream scores with the overall execution_score / outcome_probability,
- align workstream scores with the actual `workstream_cards.status` (red / amber / green) we already have on the server.

### Fix

Two-part fix in `supabase/functions/ceo-briefing/index.ts` — UI doesn't need to change.

**A. Server-authoritative pre-scoring**

Build a server-side `workstream_baseline[]` from `workstream_cards` BEFORE calling the model:

```ts
// For each project_tag in available_workstreams:
//   - card_count, red_count, amber_count, green_count, done_count
//   - days_since_last_activity (max(updated_at, last_comment_at))
//   - overdue_count (due_date < now AND status != done)
//   - derived_rag:
//       red    if red_count > 0 OR overdue_count > 0 OR days_since_last_activity > 14
//       amber  if amber_count > 0 OR days_since_last_activity > 7
//       green  if all cards green/done AND days_since_last_activity <= 7
//       silent if card_count == 0
//   - baseline_progress = round(100 * done_count / max(card_count,1))
//   - baseline_confidence = clamp(100 - days_since_last_activity*5, 10, 90)
//   - baseline_risk = red_count*30 + amber_count*15 + min(overdue_count*10, 40)
```

Inject this `workstream_baseline` into the AI evidence pack so the model has hard numbers to anchor on.

**B. Tighten the schema + add a deterministic post-processor**

Schema additions (`MORNING_SCHEMA_HINT`):

- `workstream_scores[].rag: "red" | "amber" | "green" | "silent"` (mandatory)
- `workstream_scores[].card_status_summary: string` (e.g. `"3 cards · 0 red / 3 amber / 0 green"`)
- New rule: `workstream_scores` MUST have one entry per `available_workstreams` entry — no omissions, no inventions.
- New rule: A workstream's `rag` MUST equal the server's `workstream_baseline.derived_rag` for that workstream. The model may justify but not override it.
- New rule: When briefing-level `execution_score < 50` OR `outcome_probability < 50`, **no** workstream may report `progress >= 70` AND `risk <= 30` AND `rag == "green"` — it must downgrade or cite contradicting evidence.
- New rule: `evidence` MUST quote a real card title, Azure work item, release, OR explicitly say `"Silent — no cards in the last 7 days"` for silent workstreams.

Post-processor (after the model returns, before persisting):

1. **Backfill missing workstreams** — for any `available_workstreams` entry not present, inject a row using `workstream_baseline` values, evidence = `"Auto-scored from card status: {summary}"`, `auto_injected: true`.
2. **Force RAG to baseline** — overwrite `workstream_scores[i].rag` with `workstream_baseline.derived_rag`. This is the single source of truth.
3. **Clamp inconsistent green-against-red** — if briefing-level signals are red/at-risk and a row still scores `progress >= 70 / risk <= 30`, cap `progress` at 50 and raise `risk` to 50, append `evidence += " · Score capped: contradicts overall execution_score=X / outcome_probability=Y."`.
4. **Re-key the watchlist injection logic** to use the now-guaranteed `rag` field (no behaviour change — it just starts working).

### UI

`src/pages/CEOBriefing.tsx` — minor only:
- Add a small RAG dot (red/amber/green/grey) before each workstream name in the Workstream Scorecard table, using the new `rag` field.
- Add `Cards` column showing `card_status_summary`.

No layout overhaul, no new components.

### Files to edit

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - fetchWorkstreamBaseline() — derive per-tag rag, progress, confidence, risk, card_status_summary
  - Inject workstream_baseline[] into AI context
  - Extend MORNING_SCHEMA_HINT with rag + card_status_summary + new alignment rules
  - Post-processor:
      • inject missing workstream rows from baseline
      • overwrite rag with baseline.derived_rag
      • clamp green-against-red contradictions
  - No changes to outcome_probability / execution_score logic itself

EDIT src/pages/CEOBriefing.tsx
  - Workstream Scorecard table: add RAG dot + Cards column
```

### Outcome

- All 6 workstreams (or however many are configured) appear in the scorecard, every time.
- A workstream's RAG matches the actual state of its cards — no more "60/70/40, looks fine" while the brief is At Risk and the cards are all amber.
- Watchlist auto-injection finally fires for non-green workstreams because `rag` is now guaranteed populated.
- Overall briefing trajectory, execution score, and per-workstream scores tell a single consistent story.

### Out of scope (ask if you want)

- Recomputing `outcome_probability` / `execution_score` from the workstream baseline (currently still LLM-derived from full evidence pack).
- Per-card drill-down inside the scorecard row.
- Trend deltas vs yesterday's workstream scores.

