

## Duncan CEO Operating System — Implementation Plan (v2)

Transforms Duncan into a CEO-grade decision engine. **Access is locked to `nimesh@kabuni.com` exclusively** — not admins, not leadership, not other execs.

### Access control (locked)

- `/ceo` route + sidebar entry are gated by an email check: `user.email === 'nimesh@kabuni.com'`.
- `ceo-briefing` Edge Function validates the JWT and rejects any caller whose email is not `nimesh@kabuni.com` (returns 403).
- `ceo_briefings` table RLS: SELECT/INSERT only when `auth.jwt() ->> 'email' = 'nimesh@kabuni.com'`.
- The CEO-mode prompt layer in `norman-chat` only activates when the requesting user's email is `nimesh@kabuni.com`. All other users see Duncan's normal behaviour unchanged.

If Nimesh's email ever changes or a second exec needs access, it's a one-line constant update in three places (route guard, edge function, RLS policy).

### What gets built

1. **CEO mode prompt layer** (Nimesh-only) injected into `norman-chat`: company priorities, org accountability map, Truth-Over-Narrative, scoring contract.
2. **`/ceo` page** — single-user dashboard rendering the 11-section morning briefing + 6-section evening variant.
3. **`ceo-briefing` Edge Function** — pulls 24h of data (meetings, workstreams, Azure work items, releases, hiring, POs, sync logs), sends one structured prompt to gpt-4o, returns strict JSON.
4. **`ceo_briefings` table** — persists daily scores so "what moved probability up/down" uses real deltas vs yesterday.

### Page layout

```text
┌────────────────────────────────────────────────────┐
│ CEO Briefing — 21 Apr 2026   [Morning|Evening] [↻]│
├────────────────────────────────────────────────────┤
│ Trajectory · Probability % (Δ) · Exec Score /100  │
├────────────────────────────────────────────────────┤
│ 1. Company Pulse                                   │
│ 2. Outcome Probability (June 7)                    │
│ 3. Execution Score                                 │
│ 4. What Changed Yesterday (6 function tabs)        │
│ 5. Strategic Risk Radar (top 5)                    │
│ 6. Cross-Functional Friction                       │
│ 7. Leadership Performance Assessment               │
│ 8. Accountability Watchlist                        │
│ 9. Decisions the CEO Must Make (top 3)             │
│ 10. Automation Progress                            │
│ 11. One Brutal Truth                               │
└────────────────────────────────────────────────────┘
```

### Database

```text
ceo_briefings
  id, briefing_date, briefing_type ('morning'|'evening'),
  trajectory, outcome_probability, execution_score,
  workstream_scores jsonb, payload jsonb,
  generated_by uuid, created_at
  unique(briefing_date, briefing_type)

RLS: SELECT + INSERT only when auth.jwt()->>'email' = 'nimesh@kabuni.com'
```

### Files

```text
NEW  supabase/functions/ceo-briefing/index.ts
NEW  supabase/migrations/<ts>_ceo_briefings.sql
NEW  src/pages/CEOBriefing.tsx
NEW  src/hooks/useCEOBriefing.ts
NEW  src/components/ceo/{PulseBanner,RiskRadar,LeadershipGrid,ScoreGauge}.tsx
NEW  src/lib/ceoAccess.ts            (single source of truth: CEO_EMAIL constant)
EDIT src/App.tsx                     (guarded /ceo route)
EDIT src/components/Sidebar.tsx      (entry shown only if email matches)
EDIT supabase/functions/norman-chat/index.ts  (CEO prompt layer, email-gated)
NEW  mem://features/ceo-operating-system
```

### Out of scope (next steps if wanted)

- Automated morning (07:00 UTC) + evening (19:00 UTC) cron with Slack DM to Nimesh.
- PDF export of briefing.
- 30-day probability trend chart.

