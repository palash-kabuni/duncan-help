

## Goal
Two related fixes so Section 03 (Cross-Functional Friction) actually works the way you described:

1. **Make Slack actually run** — the last briefing has `slack_pulse=null` and stale `sources_unavailable: ["slack_inbound", ...]`. The `ceo-slack-pulse` function was never invoked. Until that's fixed, friction has nothing cross-system to ground on and the section will keep coming up empty.

2. **Tighten the friction reasoning** to match what you described: scan every system, then specifically check each signal against **cards (Workstreams)** and **Azure work items** to find where things are stuck or drifting from strategy.

## Why the current output is wrong

Evidence from the latest briefing row:
- `payload.slack_pulse` → **null** (Slack scan never ran)
- `friction_meta.sources_unavailable` → still contains `"slack_inbound"` (old code path)
- `friction_meta.total = 0`, `dropped_email_only = 0` — the model emitted zero items, none filtered. Without Slack signals, it had nothing to corroborate against and gave up silently.
- `ceo-slack-pulse` edge function logs: **none** — never invoked.

So "No cross-system friction pattern reached the threshold" is technically true but hides that Slack and several reasoning checks weren't actually performed.

## What we'll change

### 1. Force Slack to run
- Re-deploy `ceo-slack-pulse` and `ceo-briefing` together.
- Add a hard sanity check: if `slack_pulse` returns null OR errors, capture the reason on `friction_meta.slack_pulse_error` instead of silently swallowing it.
- Drop `slack_inbound` from `sources_unavailable` once Slack actually returns data.

### 2. Make the friction reasoning explicit and traceable
Today the prompt says "≥2 non-email systems." We'll change it to a **structured 4-pass scan** that mirrors how you described it:

**Pass A — Strategy alignment**
For each 2026 priority (from your CEO operating system), pull the cards + Azure items tagged or semantically linked to it. Flag anything where:
- Strategy says priority X, but no cards/Azure items moved on it in 7 days
- Strategy says priority X, but Slack/email surfaced commitments that aren't represented in cards or Azure

**Pass B — Cards ↔ Azure consistency**
- Workstream card says "blocked on engineering" → check Azure for the matching work item. If Azure shows it active and on-track, that's friction (mismatched view of reality).
- Azure work item slipping past due → check if any card or Slack thread acknowledges it. If silent, that's friction (delivery slip with no ops awareness).

**Pass C — Cross-system corroboration**
For every Slack escalation, email risk, or meeting action item, check whether it appears in cards/Azure within 48h. If not → "raised but not actioned" friction.

**Pass D — Strategic gaps**
Compare the union of (cards + Azure + meetings + slack signals) against the 2026 priority list. Any priority with **zero activity in any system** in the last 7 days = "strategic gap" friction item, even if nothing is "broken" — it's drift.

Each friction item must declare:
- Which pass found it (A/B/C/D)
- Exact card IDs, Azure work item IDs, Slack message refs, or meeting refs as evidence
- Which 2026 priority it relates to (or "none — orphan work")

### 3. Honest empty state
Replace the vague one-liner with a structured breakdown so you can see the reasoning even when nothing fires:

```
03 · CROSS-FUNCTIONAL FRICTION — none surfaced

Scanned:
• Workstream cards: 47   • Azure work items: 23
• Meetings (7d): 12      • Slack channels: 14 of 30 (16 not invited)
• Slack messages: 312    • Email mailboxes: 3 of 8 opted in
• 2026 priorities checked: 6

Reasoning passes:
• Pass A (Strategy alignment): 0 gaps
• Pass B (Cards ↔ Azure consistency): 0 mismatches
• Pass C (Cross-system corroboration): 4 candidates, all actioned within 48h
• Pass D (Strategic drift): 0 priorities silent

Sources offline: HubSpot (not connected).
```

If `slack_pulse_error` is set, prepend a warning: **"Slack scan failed: <reason>. Friction may be under-reported."**

## Files touched
- `supabase/functions/ceo-briefing/index.ts` — re-deploy; capture `slack_pulse_error`; rewrite friction prompt to declare the 4-pass scan; populate `friction_meta.scanned` (counts) and `friction_meta.passes` (per-pass results).
- `supabase/functions/ceo-slack-pulse/index.ts` — re-deploy as-is; add explicit error returns instead of silent failures.
- `src/pages/CEOBriefing.tsx` — Section 03 empty state: render the structured breakdown above using `friction_meta`.

## Out of scope
- HubSpot connector (still not wired — surfaced as "offline" in the empty state).
- Auto-inviting Duncan to Slack channels (listed in coverage so the team can invite manually).
- Changing the 2026 priority list itself — we read it from the existing CEO operating system memory.

