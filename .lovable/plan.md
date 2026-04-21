

## Log latest CEO Briefing changes to What's New

Add a new published release entry to the `releases` table summarising the past ~8 hours of CEO Briefing work, using the same `{type, description}` format as v1.2.0.

### Release

- **version**: `v1.3.0`
- **status**: `published`, `published_at = now()`
- **title**: `CEO Briefing — sharper signals, fewer duplicates`
- **summary**: `Major upgrade to the CEO Briefing: every section now grounded in real data, no duplicated render blocks, mobile-friendly layout, and a real productivity signal in Automation Progress.`

### Changes (in v1.2.0 format)

```json
[
  {"type":"feature","description":"CEO Briefing Section 06 'Friction Map' now auto-injects evidence-backed friction items from coverage gaps, stuck workstreams and overdue cards"},
  {"type":"feature","description":"CEO Briefing Section 08 'Watchlist' auto-populates from non-green workstreams, silent priorities and overdue accountability gaps"},
  {"type":"feature","description":"CEO Briefing Section 09 'Decisions the CEO Must Make' now mandatory — surfaces owner assignments, go/no-go calls and cross-functional escalations"},
  {"type":"feature","description":"CEO Briefing Section 07 'Automation Progress' rebuilt as a real productivity signal: 30-day company usage, top 3 power users with estimated hours saved, and top 3 recommendations for what to build next in Duncan"},
  {"type":"feature","description":"Workstream Scorecard now server-authoritative — every workstream is scored every briefing, RAG status is derived from actual card state, and scores can no longer contradict the overall briefing trajectory"},
  {"type":"improvement","description":"CEO Briefing UI deduplicated — score, trajectory and section numbers now appear once in a single clean 01-08 sequence"},
  {"type":"improvement","description":"CEO Briefing 'At Risk' PulseBanner is now mobile-friendly with proper stacking, no text wrap, and responsive dividers"},
  {"type":"improvement","description":"Workstream Scorecard table now shows a RAG dot and a Cards column (e.g. '3 cards · 0 red / 3 amber / 0 green') for at-a-glance status"},
  {"type":"improvement","description":"Auto-flagged + Source chips extended across Sections 05, 06, 07 and 09 so the CEO can see exactly which evidence drove each recommendation"},
  {"type":"fix","description":"Workstream Scorecard no longer reports 'Green' rows when the overall briefing is At Risk — scores are clamped against contradicting evidence"},
  {"type":"fix","description":"Workstream Scorecard no longer omits workstreams — missing rows are auto-backfilled from card status"},
  {"type":"fix","description":"Watchlist auto-injection now fires correctly for amber/yellow workstreams (previously silently broken by missing RAG field)"}
]
```

### Implementation

Single SQL insert via migration:

```sql
INSERT INTO public.releases (version, status, title, summary, changes, published_at)
VALUES ('v1.3.0', 'published', '...', '...', '<json above>'::jsonb, now());
```

### Files to edit

```text
NEW supabase/migrations/<timestamp>_release_v1_3_0_ceo_briefing.sql
  - Insert v1.3.0 release row with the 12 changes above
```

### Out of scope

- Sending the email notification (admin can click "Send Notification" on the card after publish)
- Any code/UI changes — this is purely a content entry

