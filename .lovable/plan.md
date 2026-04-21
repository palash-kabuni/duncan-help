

## Two Fixes: Honest Coverage Prose + Scan Meeting Transcripts

### Bug A — "3 out of 6" prose contradicts server data

Server-truth: **1 of 6** priorities covered (only `Lightning Strike Event`). UI panel renders that correctly. But the AI's `company_pulse` / `brutal_truth` / `execution_explanation` strings still hallucinate "3 out of 6" because the prompt never tells the model the deterministic coverage counts — it only sees `coverage_report` and infers loosely.

**Fix:** Inject the server-computed `coverage_summary` directly into the user prompt as an authoritative pre-computed fact, and add a hard prompt rule:

> "`coverage_summary` is server-computed truth. You MUST use these exact numbers (`covered`/`total`/`ratio`) verbatim in `company_pulse`, `brutal_truth`, and `execution_explanation`. Do NOT recompute, infer, or estimate coverage in prose. Do NOT claim a priority is covered unless it appears in `coverage_summary.covered_priorities`."

Plus a server-side post-check: scan `company_pulse`, `brutal_truth`, `execution_explanation` for digit patterns like `\d\s*(of|out of|/)\s*6` — if the digit doesn't match `coverage_summary.covered`, append a corrective sentence: *"(Server correction: only X of 6 priorities have an active workstream.)"*

### Bug B — Meeting transcripts ignored

Current `meetings` query selects `title, meeting_date, summary, action_items, participants` only. The `transcript` field (45 meetings, mostly Lightning Strike standups, some 100k+ chars) is never sent to the model, so Duncan can't see what's *actually being discussed* about KPL registrations, trials, pre-orders, automation — the missing priorities the CEO is asking about.

**Fix:** add a transcript-scanning pass before the AI call:

1. Pull `transcript` from last 10 meetings (cap each at ~6k chars to control token cost).
2. For each `PRIORITY_DEFINITIONS` entry, run a lightweight keyword scan over each transcript using its aliases (case-insensitive). Build:
   ```text
   meeting_priority_signals = [
     {
       priority_id, priority_title,
       mentions: [
         { meeting_title, meeting_date, snippet (±200 chars around hit), alias_matched }
       ]
     }
   ]
   ```
3. Inject `meeting_priority_signals` into the AI context.
4. Add prompt rule:
   > "Use `meeting_priority_signals` to detect *implicit* coverage — work happening on a 2026 priority WITHOUT a formal workstream. For any priority that has signals but no workstream, the corresponding `coverage_gaps` entry MUST add a `current_signal` field summarising what's being discussed and a `recommended_action` like 'Formalise into a workstream — work is already happening but untracked.' This is more urgent than priorities with zero signal."

5. UI surfaces this in `CoverageGaps.tsx`: gaps with `current_signal` get a yellow "⚠ Work in progress but untracked" tag; truly silent gaps get a red "🔴 No activity detected anywhere" tag. Two different CEO actions.

### Token-cost guard

Transcript payload could balloon. Cap rules:
- Last 10 meetings only (most recent).
- Per-transcript: keep only the **first 6,000 chars** of each.
- If total transcript bytes > 60k, switch to "snippet-only" mode — drop full transcripts and send only the 200-char windows around alias hits.

GPT-4o handles 128k context comfortably even at maximum.

### Files

```text
EDIT supabase/functions/ceo-briefing/index.ts
       - Fetch transcripts (cap 6k per, last 10)
       - scanTranscriptsForPriorities() helper → meeting_priority_signals
       - Inject coverage_summary + meeting_priority_signals into userPrompt
       - Prompt rule: use server numbers verbatim; flag implicit coverage
       - Post-check: regex scan prose for "X of 6" mismatches, append correction
EDIT src/components/ceo/CoverageGaps.tsx
       - Render current_signal badge ("Work in progress but untracked")
       - Distinguish silent vs active-but-untracked gaps visually
EDIT mem://features/ceo-operating-system.md
       - Note transcript-scanning + server-verbatim coverage rule
```

### Result on next regenerate

```text
Coverage Gaps — 1 of 6 priorities have an active workstream (17% covered)

🔴 1M KPL Registrations           — no signal anywhere · suggest Alex (CMO)
🔴 100k Pre-orders                — no signal anywhere · suggest Alex (CMO) + Patrick (CFO)
⚠  Trials Oct/Nov 2026            — discussed in 3 recent Lightning Strike standups
                                    but no workstream → formalise · suggest Simon
⚠  10-team Dec selection          — referenced in All Hands 20 Apr · suggest Simon + Matt
🔴 Duncan automates 25%           — no signal · suggest Palash

Brutal truth: "Only 1 of 6 priorities has a tracked workstream. Two others are
being actively worked on in standups but invisible to Duncan. Three have no
trace of work at all. Probability remains capped at 35%."
```

### Out of scope

- Embedding-based semantic transcript search (regex aliases sufficient at current scale).
- Automatically creating workstreams from detected signals (still requires CEO click).

