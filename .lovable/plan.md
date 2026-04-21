

## CEO Operating System — Coverage Audit & Tightening Plan

### What's already covered ✅

| Prompt section | Status | Where |
|---|---|---|
| Identity (decision engine, not summariser) | ✅ | `ceo-briefing` system prompt + `norman-chat` CEO mode |
| 6 Non-Negotiable 2026 Priorities | ✅ | Both prompts, verbatim |
| Org map (8 leaders) | ✅ | Both prompts |
| Decision/Escalation logic | ✅ | `norman-chat` CEO block |
| Truth Over Narrative | ✅ | Both |
| Illusion Detection | ✅ | Both |
| Pattern Recognition (today vs prior) | ✅ | Both — previous_briefing row injected |
| Pressure Rule | ✅ | Both |
| Outcome Probability (% + movement) | ✅ | `outcome_probability` field + delta vs prev |
| Scoring system (Progress/Confidence/Risk + Exec Score) | ✅ | `workstream_scores` + `execution_score` |
| 11-section morning briefing | ✅ | All 11 fields in MORNING_SCHEMA_HINT |
| 6-section evening briefing | ✅ | EVENING_SCHEMA_HINT |
| Nimesh-only access | ✅ | RLS + edge function + route guard |
| Persistent scoring history | ✅ | `ceo_briefings` table |

### Gaps vs final prompt — needs tightening 🔧

The current implementation works but is **lighter than the final prompt demands**. Five gaps to close:

**1. Data ingestion is incomplete.** Final prompt requires emails, Slack, CRM, financial, and "Duncan system logs". Current edge function pulls 11 sources but **misses**:
- Recent Gmail messages (emails in/out last 24h for Nimesh)
- Slack activity (we have the connector — currently unused for briefing)
- Token usage stats (Duncan system logs / automation footprint)
- Xero financial data (we sync it but don't feed it in)
- Integration audit logs (system health signal)

**2. Analytical Framework dimensions not enforced.** Prompt mandates evaluation against six axes (Progress vs goals, Execution quality, Risk exposure, Commercial impact, Dependency strength, Cross-functional alignment). Current schema doesn't ask for these explicitly per workstream.

**3. Risk Radar severity uses 4 levels but prompt says severity + confidence are both mandatory** — already there, but the prompt also wants 7d/30d/90d **as separate quantified impacts**, not loose strings. Current schema has them as `string`; tightening to short structured statements.

**4. Final Instruction question-answer framing missing.** Prompt ends with "Are we on track / What will break / Where must I act". The morning briefing should explicitly answer those three at the top, before Section 1, as a TL;DR. Currently absent.

**5. CEO mode in `norman-chat` doesn't enforce the Analytical Framework or Final Instruction.** It has the rules block but no explicit response shape for ad-hoc questions.

### What this plan changes

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - Add Gmail (last 24h subject/from/snippet for nimesh@kabuni.com) via service-role read of gmail_messages
  - Add Slack signal (recent slack_messages if table exists; else skip gracefully)
  - Add token_usage (last 24h aggregate — automation footprint)
  - Add xero_invoices / xero_bills (financial pulse, last 24h)
  - Add integration_audit_logs (system health)
  - Tighten MORNING_SCHEMA_HINT:
      • Add top-level "tldr": { "on_track": string, "what_will_break": string, "where_to_act": string }
      • Add per-workstream: progress_vs_goal, execution_quality, commercial_impact, dependency_strength
      • Risks 7d/30d/90d become structured: { window, impact, mitigation }
  - Strengthen system prompt: include full Analytical Framework + Final Instruction verbatim
  - Add explicit "If data is weak, lower confidence and say so" reminder
  - Bump context cap from 60k → 120k chars to fit added sources

EDIT supabase/functions/norman-chat/index.ts (CEO block only)
  - Append Analytical Framework (6 axes)
  - Append Final Instruction (3 questions Duncan must answer)
  - Add response shape rule: every CEO answer ends with "On track? · What breaks? · Where to act?"

EDIT src/pages/CEOBriefing.tsx
  - Render new "TL;DR" panel above Section 1 (3 bold answers)
  - Show new analytical-framework fields under each workstream score row

EDIT src/components/ceo/RiskRadar.tsx
  - Render structured 7d/30d/90d (window · impact · mitigation) instead of free text

NEW   src/components/ceo/TldrPanel.tsx
  - Three-question executive header

EDIT mem://features/ceo-operating-system.md
  - Note: CEO mode now enforces Analytical Framework + Final Instruction shape
```

### What stays out of scope

- Cron auto-generation (morning 07:00 UTC, evening 19:00 UTC) + Slack DM to Nimesh
- PDF export
- 30-day probability trend chart
- Email/Slack ingestion for non-CEO users (Nimesh-only by design)

### Technical notes

- All new data sources read with service-role inside the edge function — RLS unaffected.
- If `gmail_messages` / `xero_invoices` / `slack_messages` tables don't exist or are empty for Nimesh, the function degrades silently (returns `[]` for that source) — no breaking change.
- Token cost rises ~30% per briefing due to richer context; gpt-4o handles 128k context comfortably.
- No DB migration needed — schema additions are inside `payload jsonb`.

