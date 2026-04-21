

## Fix: Section 6 "Cross-Functional Friction" is always empty

### Root cause

The briefing schema declares `friction: [{issue, teams, consequence}]` but **the prompt never tells the AI when or how to populate it**. There are no rules, no evidence sources, no examples, no minimum count, no deterministic floor. The model returns `[]` on every briefing — which is what you're seeing.

Compare to Risk Radar (works) — has explicit reconciliation rules, severity floors, and synthetic injection. Friction has zero rules.

Last briefing (2026-04-21 morning): `friction_count = 0`. Confirmed in DB.

### What "cross-functional friction" should actually mean

A friction is a structural blocker between ≥2 functions/teams that no single owner can unblock alone. Examples Duncan can detect from existing data:

- **Workstream owner mismatch** — card owned by Marketing but blocked by Tech (cross-team dependency in `workstream_cards.notes` or assignee chains)
- **Meeting decisions without a single owner** — Plaud transcript shows agreement but no owner assigned, decision spans two functions
- **Email escalations crossing functions** — `ceo-email-pulse` already extracts `escalations[{from, to, topic}]` — cross-function ones are friction signals
- **Domain/priority handoff gaps** — e.g. India launch (Lightning Strike) has Marketing artifacts but no Ops runbook, or Trials Ops has no Product spec — derivable from `data_coverage_audit.strategic_coverage`
- **Silent leader on an active priority** — if a priority has cards moving but its expected owner is `silent` in `leader_signal_map`, that's friction between the active doers and the absent owner
- **Conflicting source data** — `document_intelligence.contradicted_by` already flags doc-vs-system conflicts; cross-function ones (e.g. CFO plan vs CMO spend) are friction

### The fix

**1. Add explicit prompt rules for `friction[]`** (after the existing `risks` reconciliation rule on line 155):

```text
- payload.friction RULES:
  Cross-functional friction is a structural blocker between ≥2 functions
  that NO single owner can unblock alone. You MUST scan for friction in:
    a. workstream_cards where the owner's function ≠ the function of the
       blocker mentioned in card.notes/title (e.g. CMO-owned card blocked
       by tech delivery)
    b. meetings_recent where transcript_summary mentions a decision
       spanning two functions but no single owner is named
    c. email_pulse.escalations where from.function ≠ to.function
    d. data_coverage_audit.strategic_coverage where a priority has
       artifacts in one domain (e.g. Marketing) but is Red in another
       (e.g. Operations) — that handoff IS friction
    e. leader_signal_map where a priority has active cards but the
       expected_owner is "silent" — friction between doers and absent owner
    f. document_intelligence.contradicted_by entries that span functions
       (e.g. CFO budget contradicts CMO spend plan)

  For EACH friction:
    - "issue": one sentence naming the structural blocker (not a task)
    - "teams": EXACTLY the function names involved (≥2), e.g.
      ["Marketing","Operations"] or ["CFO","CMO"]
    - "consequence": which 2026 priority this puts at risk + by when
    - NEW field "evidence_source": one of
      "workstream_card"|"meeting"|"email"|"coverage_gap"|"silent_leader"|"doc_conflict"
    - NEW field "recommended_resolver": "CEO" if cross-divisional,
      otherwise the most senior shared manager

  MINIMUM: If outcome_probability < 50 OR any 2026 priority has
  coverage_pct < 40, friction[] MUST contain ≥3 entries. An empty
  friction[] on a Red briefing is a reporting failure, not an honest
  signal of harmony.
```

**2. Deterministic post-processor floor** (mirrors the Risk Radar pattern):

After AI output, before persisting:

- For every `silentMissing` priority, if no friction entry mentions it, **inject** one: `{issue: "${priority} has active workstream activity but its expected owner (${owner}) is silent — handoff broken", teams: [owner_function, "Cross-functional"], consequence: "${priority} target at risk", evidence_source: "silent_leader", recommended_resolver: "CEO", auto_injected: true}`
- For every email `escalation` where sender and recipient functions differ, inject one if not already covered
- If `outcome_probability < 50` and final friction count is still 0, inject a system-flagged entry: `"Friction detection ran but found nothing — verify Duncan has visibility into cross-team blockers, this is unusual on a Red briefing"`

**3. UI: surface evidence + auto-flag tag**

```text
EDIT src/pages/CEOBriefing.tsx (Section 6)
  - For each friction, render:
      • issue (already there)
      • teams as colored chips, not joined string
      • consequence (already there)
      • NEW: small "Evidence: {source}" mono chip
      • NEW: dashed border + "Auto-flagged" tag when auto_injected=true
      • NEW: "Resolver: {recommended_resolver}" line
  - Empty state when truly zero AND briefing is Green: show
    "No structural friction detected" with a ShieldCheck icon
    (currently it just shows nothing, which looks broken)
```

### Files to edit

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Update friction schema entry (line 105) to include evidence_source,
    recommended_resolver, auto_injected
  - Add the friction RULES block to the prompt (after line 155)
  - Add post-processor: inject synthetic friction for silent priorities,
    cross-function email escalations, and Red-briefing fallback

EDIT src/pages/CEOBriefing.tsx
  - Section 6 rendering: team chips, evidence chip, auto-flag styling,
    explicit empty state
```

### Outcome

- Section 6 will populate on every briefing where friction actually exists in the data — currently the most common signals (silent leaders blocking active priorities, cross-function email escalations, coverage handoff gaps) are completely invisible.
- A Red briefing can no longer ship with an empty Section 6.
- Each friction tells the CEO not just *what* but *who needs to break the deadlock* (recommended_resolver) and *how Duncan knows* (evidence_source).

### Out of scope (ask if you want)

- One-click "Send to resolver" using `send-ceo-briefing-actions` for each friction
- Friction trend chart — count over the last 14 briefings to spot recurring deadlocks
- Auto-creating a workstream card per friction with the resolver as owner

