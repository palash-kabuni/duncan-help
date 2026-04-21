

## Re-audit: Are Sections 8 & 9 telling the truth — given everything Duncan now knows?

Honest answer: **No. Both sections are now lying by omission.** Here's why, and the minimal fix.

### What's changed since the last audit

Duncan now knows — server-side, deterministically — that it is **flying blind on Finance Planning, Legal, Tech Direction, Investor/Board, and Product Strategy** (the Data Coverage Audit). It also knows its own `confidence_cap` is Medium or Low because of those blind spots.

Sections 8 and 9 still write as if Duncan can see everything. That is the lie.

### Section 8 — Accountability Watchlist ❌ Misleading

**Today** the watchlist row is `{workstream, owner, status, missing}`. The model is told to fill `missing` from workstream/Azure data only. So when a workstream is Yellow because Duncan **has no contract, no architecture doc, no financial plan to verify against**, the row says things like *"missing: progress update"* — which is operationally true and strategically false. The real "missing" is the document Duncan has never been allowed to read.

It is also missing **"what good looks like"** (the benchmark) — that gap is still real from the previous audit.

### Section 9 — Decisions the CEO Must Make ❌ Overconfident

**Today** decisions render with no honesty signal. A decision like *"Lock India launch comms"* is presented at the same confidence as one Duncan can fully evidence. But if Legal and Finance Planning are Red, Duncan literally cannot judge whether that decision is sound — yet Section 9 still demands the CEO act on it. That's exactly the behaviour the Data Coverage Audit was built to prevent, and Section 9 is the one place it isn't applied.

It also has no `confidence` and no `blocked_by_missing_data` flag, so the CEO can't tell which decisions are grounded vs guessed.

### The fix — make 8 & 9 inherit the Data Coverage Audit

One coherent change. Both sections become honest about their own evidence base.

**Section 8 — Accountability Watchlist**

Add two fields per row:
- `good_looks_like: string` — concrete definition of done (restores the original spec)
- `data_blind_spot: string | null` — if this workstream sits in a Red/Yellow knowledge domain, name the missing document/signal here (e.g. *"No signed vendor contract on file — Legal domain Red"*). Null if fully evidenced.

The model is forced to populate `data_blind_spot` whenever the workstream maps to a Red/Yellow domain in `data_coverage_audit`.

**Section 9 — Decisions the CEO Must Make**

Add two fields per decision:
- `confidence: "high" | "medium" | "low"` — capped by `data_coverage_audit.confidence_cap`. A decision can never exceed the briefing's overall cap.
- `blocked_by_missing_data: string | null` — if the decision depends on a Red domain (e.g. financial plan, legal sign-off, tech roadmap), say so explicitly. Null if grounded.

Decisions where `blocked_by_missing_data` is non-null get rendered with an amber "Decide blind?" warning and a one-click link to upload the missing document.

### Files

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Schema: watchlist[] += good_looks_like, data_blind_spot
  - Schema: decisions[]  += confidence, blocked_by_missing_data
  - CRITICAL RULES: 
      • watchlist[].good_looks_like must be a concrete definition of done
      • watchlist[].data_blind_spot must be set when the workstream's
        function area maps to a Red/Yellow domain in data_coverage_audit
      • decisions[].confidence must NEVER exceed data_coverage_audit.confidence_cap
      • decisions[].blocked_by_missing_data must name the Red domain
        (legal / finance_planning / tech_direction / etc.) whenever
        the decision cannot be honestly judged without that evidence

EDIT src/pages/CEOBriefing.tsx
  - Section 8 table: add "What Good Looks Like" and "Blind Spot" columns
       • Blind spot cell: amber AlertTriangle + text when present
  - Section 9 cards: 
       • Confidence pill (high/medium/low) per decision
       • Amber "Decide blind — missing {domain}" banner + 
         "Upload to fix" link to /projects when blocked_by_missing_data is set
```

### Outcome

After this:
- Section 8 stops pretending the only gap is execution. It names the **document Duncan was never given** alongside the operational gap.
- Section 9 stops pretending every decision is equally grounded. Decisions Duncan cannot honestly judge are **flagged amber, capped at the briefing's confidence ceiling, and pointed at the missing upload**.
- The CEO finally sees a briefing where every page tells the same truth: *"this is what I see, this is what I can't see, and here's how it limits my advice."*

### Out of scope (ask if you want)

- Auto-suggesting which exec to email when a decision is blocked by a Red domain (uses existing `send-ceo-briefing-actions` routing)
- Showing a per-section "evidence score" (how grounded each of the 10 sections is) at the top of the briefing
- Persisting `decision_id → resolved` so the next briefing knows which decisions the CEO actually made

