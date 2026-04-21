

## Two fixes: deep file review + watchlist owner diversity

### Problem 1 — Duncan never reads the files, only their names

Today the briefing pulls `project_files.file_name` only. The Data Coverage Audit can say *"a file called 'Finance Plan v3.pdf' exists"* but Duncan has never read its contents. So when Nimesh uploads a financial plan, Duncan still can't tell him whether the **plan itself is good enough** — only that the filename matches a keyword. That's the opposite of "deep dive into them and report back what's missing."

### Problem 2 — Watchlist looks Simon-heavy

`PRIORITY_DEFINITIONS` lists Simon as the `expected_owner` (or co-owner) on **3 of 6** priorities (Lightning Strike, Trials, Team Selection). The model then defaults `watchlist[].owner` to that field, so the watchlist visibly skews to Simon even when Alex/Patrick/Matt/Parmy/Palash are the right accountable owner for that workstream's actual blocker.

---

### Fix 1 — Deep file review: ingest content, cross-check against other data

**Server (`supabase/functions/ceo-briefing/index.ts`)**

1. **Pull file contents, not just names.** Project files are already chunked & embedded in `project_file_chunks` (used by the RAG pipeline). For each Red/Yellow/Green domain that has matched files, fetch the **first ~3 chunks per file** (≈2k chars each) for the most recent 1–2 files per domain. Cap total at ~30k chars across all domains so the prompt stays under control.

2. **New deterministic field per domain → `file_review`:**
   ```text
   file_review: {
     files_inspected: [{name, last_updated, chunks_read, byte_size}],
     content_excerpt: "<first ~6k chars of joined content per domain, deduped>",
   }
   ```

3. **New AI output — `payload.document_intelligence`** (one entry per domain that has files):
   ```text
   {
     domain: "finance_planning",
     file_name: "Finance Plan v3.pdf",
     verdict: "weak" | "adequate" | "strong",
     what_it_covers: string,           // grounded in the excerpt
     what_is_missing_in_doc: string,   // gaps INSIDE the doc
     contradicted_by: [string],        // facts in OTHER data sources (Xero, workstreams, meetings) that contradict this doc
     reinforced_by: [string],          // facts in OTHER data sources that confirm this doc
     critical_gaps_to_fix: [string]    // 1-3 concrete asks
   }
   ```

   The model is required to **cross-reference** the excerpt against `xero_invoices`, `workstream_cards`, `azure_work_items`, `meetings`, and `recent_releases`. Example output the prompt forces: *"Finance Plan v3 assumes £180k Q2 burn, but Xero shows £241k actual burn over the trailing 90d → contradicted_by: ['xero_invoices']."*

4. **Domain status is upgraded with content quality.** A domain that has matching files but `document_intelligence.verdict === "weak"` is downgraded from Green to **Yellow** and from Yellow to **Red**, with `evidence` rewritten to: *"Finance plan exists but is weak — assumes £180k burn vs £241k actual."* This makes the Data Coverage Audit reflect document **quality**, not just **presence**.

5. **Confidence cap re-applied** after the quality downgrade so a weak finance plan triggers the same medium/low cap as a missing one.

**UI (`src/components/ceo/DataCoverageCard.tsx` + `CEOBriefing.tsx`)**

- Per domain row: when `document_intelligence` exists, show an expandable accordion with the verdict pill (weak/adequate/strong), the gaps inside the doc, the contradictions found in other systems, and the 1–3 fixes.
- Add a top-line counter: *"Documents reviewed: 4 · Weak: 2 · Adequate: 1 · Strong: 1."*

### Fix 2 — Watchlist owner accuracy (no more "Simon column")

**Server (`supabase/functions/ceo-briefing/index.ts`)**

1. **Stop defaulting watchlist owner to `expected_owner`.** Add a new prompt rule:

   ```text
   watchlist[].owner MUST be the person actually accountable for the
   specific blocker — derived from workstream_cards.owner_id (resolved
   via team_directory), azure_work_items.assigned_to, or the function
   area in `what_changed`. Use PRIORITY_DEFINITIONS.expected_owner ONLY
   as a tie-breaker, never as the default.

   No single owner may appear on more than 40% of watchlist rows. If
   the data genuinely concentrates on one person, split the row into
   sub-issues attributed to the actual contributors (e.g. CMO for
   marketing-side blockers, CFO for funding gates, CTO for tech
   readiness), or escalate to the CEO.
   ```

2. **Server-side post-processor** that, after the model returns:
   - Counts owner frequency in `watchlist`. If any owner > 40% of rows, demote the surplus rows to a generic *"Cross-functional — escalate to CEO"* owner with a `reassignment_reason`.
   - Resolves owner names against `team_directory` so display names are real (no hallucinated titles).

3. **Loosen the over-assignment in `PRIORITY_DEFINITIONS`:**
   ```text
   trials.expected_owner       → "Simon (Ops Director) + Alex (CMO)"
   team_selection.expected_owner → "Matt (CPO) + Simon (Ops Director)"
   lightning_strike            → unchanged (Nimesh + Simon is correct)
   ```
   This keeps Simon where he genuinely owns, but breaks the auto-cascade onto his name.

**UI (`src/pages/CEOBriefing.tsx`)**

- When a row's owner is auto-rebalanced, show a small amber tag: *"Reassigned — single-owner concentration"*. This makes the rule visible to the CEO so it's never silently distorted.

### Files

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Pull project_file_chunks (top-1-2 files per matched domain, ~3 chunks each)
  - Build domain_file_review map; pass into context as `domain_file_review`
  - Schema += payload.document_intelligence[]
  - Prompt rules: cross-reference excerpts vs Xero / workstreams / Azure / meetings
  - After parse: downgrade domain status when verdict === "weak"; re-apply
    confidence cap; rewrite domain.evidence with the weakness reason
  - Watchlist owner rule + 40%-cap post-processor
  - Loosen Simon-heavy expected_owner on trials + team_selection

EDIT src/components/ceo/DataCoverageCard.tsx
  - Per-domain expandable row: verdict pill + what_it_covers +
    what_is_missing_in_doc + contradicted_by + reinforced_by + fixes
  - Top-line counter: documents reviewed / weak / adequate / strong

EDIT src/pages/CEOBriefing.tsx
  - Watchlist row: amber tag when owner was auto-rebalanced
```

### Outcome

- Duncan **reads** uploaded files (not just file names), reports their **quality**, and names exactly which other systems **contradict or confirm** them.
- A weak plan is treated almost as harshly as a missing plan — confidence is capped accordingly.
- The watchlist is **owner-balanced** by rule. Simon stops appearing as the default accountable person for everything that touches Ops.

### Out of scope (ask if you want)

- Auto-emailing the document owner ("Patrick — Finance Plan v3 is weak: §X missing") via existing `send-ceo-briefing-actions` routing
- A standalone *Document Health* page listing every uploaded file with verdict + last-reviewed date
- Recursively pulling Google Drive folders so domain coverage fills itself before the CEO has to upload manually

