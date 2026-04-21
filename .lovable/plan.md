

## Fix: Section 8 "Accountability Watchlist" is empty on every briefing

### Root cause

Same shape of bug as Section 6 was. The schema declares `watchlist[{workstream, owner, status, good_looks_like, missing, data_blind_spot}]` and there are quality rules for *each row* (good_looks_like, owner concentration cap, blind-spot tagging) — but **no rule tells the AI when watchlist must be populated and what minimum coverage looks like**. So the model returns `[]` and ships.

Confirmed on the latest 2026-04-21 morning briefing: `watchlist_count = 0`, despite `workstream_scores`, silent leaders, and Red coverage domains all being present.

The post-processor at line 1469 only runs *if* `watchlist.length > 0` — so it rebalances owner concentration but never injects rows when the AI returns nothing. The UI then renders an empty `<table>` with headers and zero rows, which looks like a broken section.

### What "Accountability Watchlist" should actually mean

A watchlist row is a **named workstream + named owner + what "done" looks like + what's missing right now**. Duncan already has every input it needs:

- Every entry in `workstream_scores` that isn't Green is a candidate
- Every `silent_priority` (priority with no owned workstream) is a candidate — owner = expected_owner from `PRIORITY_DEFINITIONS`
- Every Red/Yellow domain in `data_coverage_audit.strategic_coverage` with no matching watchlist row is a candidate
- Every `silent` leader who owns a 2026 priority is a candidate

### The fix

**1. Add explicit `watchlist[]` population rules** (in the same CRITICAL RULES block, after rule 148):

```text
- payload.watchlist POPULATION RULES:
  watchlist[] is the operational accountability ledger. It MUST contain
  one row for EACH of the following, with NO duplicates:
    a. Every workstream_score where rag != "green" (Red, Yellow, At Risk)
    b. Every entry in headline_context.silent_priorities (owner =
       PRIORITY_DEFINITIONS.expected_owner, status = "No owned workstream",
       missing = "No cards, no Azure items, no releases attributed")
    c. Every 2026 priority where data_coverage_audit.strategic_coverage
       coverage_pct < 50 that is not already covered by (a) or (b)
    d. Every leader_signal_map entry with signal_status="silent" AND
       owns_priorities.length > 0 (one row per priority they own)

  MINIMUM count = max(3, count of non-green workstreams + silent_priorities).
  An empty watchlist[] when outcome_probability < 70 OR coverage_gaps
  is non-empty is a reporting failure.

  For each row:
    - "workstream": exact name from workstream_scores OR the 2026 priority name
    - "owner": real accountable person (rule 148 still applies)
    - "status": one of "Red", "Yellow", "At Risk", "Silent", "Uncovered"
    - "good_looks_like": observable definition of done (rule 146)
    - "missing": the SPECIFIC artifact, decision, or signal that's absent
    - "data_blind_spot": Red/Yellow domain name if applicable, else null
```

**2. Deterministic post-processor floor** (mirrors the friction fix, runs *before* the existing 40% concentration cap):

After AI output, before the existing `wl.length > 0` block:

- Build `requiredRows[]` from: non-green workstream_scores + silent_priorities + Red coverage domains + silent leaders owning priorities
- For each `requiredRow` not already represented in `parsed.payload.watchlist` (matched by case-insensitive workstream name), inject:
  ```
  { workstream, owner: <expected_owner or "Cross-functional — escalate to CEO">,
    status: <derived: Silent | Uncovered | Red | Yellow>,
    good_looks_like: <from PRIORITY_DEFINITIONS.success_criteria when known>,
    missing: <"No owned workstream" | "Coverage <40% in {domain}" | "Owner silent 7d">,
    data_blind_spot: <domain name or null>,
    auto_injected: true }
  ```
- If final watchlist is still empty AND `outcome_probability < 70`, inject one system row: `{workstream: "Watchlist detection failed", owner: "Duncan", status: "Red", missing: "Verify briefing has visibility into workstreams + priorities — unusual on a non-green briefing", auto_injected: true}`

Then run the existing 40% owner-concentration cap on the combined list.

**3. UI: surface auto-flag tag + explicit empty state**

```text
EDIT src/pages/CEOBriefing.tsx (Section 8)
  - Add new column "Source" (small mono chip): "AI" | "Auto-flagged"
    using w.auto_injected
  - For auto_injected rows: dashed left border on the <tr>
  - When watchlist is truly [] AND briefing is Green: show
    "All workstreams green and fully evidenced — no accountability gaps"
    with a ShieldCheck icon (mirrors the §6 empty state)
  - Currently it just renders an empty <table> body which looks broken
```

### Files to edit

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Add watchlist POPULATION RULES block after line 148
  - Update schema entry (line 107) to add "auto_injected": boolean
  - New post-processor block BEFORE the existing line 1469 block:
    inject required rows from non-green workstreams, silent priorities,
    Red coverage domains, silent leaders owning priorities
  - Existing 40% concentration cap then runs on the combined list

EDIT src/pages/CEOBriefing.tsx
  - Section 8 table: add Source column with AI / Auto-flagged chip
  - Dashed left border on auto_injected rows
  - Empty-state card with ShieldCheck when truly zero on a Green briefing
```

### Outcome

- Section 8 will populate on every non-green briefing — currently the most common signals (silent priorities, uncovered domains, silent leaders) are completely invisible there.
- Each row tells the CEO *which workstream*, *who owns it*, *what done looks like*, and *what's missing right now* — and whether Duncan inferred it deterministically (`Auto-flagged`) or the AI surfaced it.
- A Red briefing can no longer ship with an empty Section 8.

### Out of scope (ask if you want)

- One-click "Send to owner" per watchlist row using `send-ceo-briefing-actions`
- Auto-create a workstream card per `Uncovered` / `Silent` row with the owner pre-assigned
- Trend chart of watchlist size + auto-injection ratio across the last 14 briefings (early signal of AI under-reporting)

