

## Leadership Performance — what's actually being checked today

### Today's reality

`computeLeaderSignalMap` (the deterministic per-leader tally that drives §04) only looks at **4 sources**:

1. `meetings` — title, summary, participants
2. `workstream_cards` — owner + title
3. `azure_work_items` — assignee + title
4. `releases` — title

That's it. So for **Nimesh Patel** specifically:
- Calendar events (your diary) → **not checked**
- Sent / received emails (Gmail) → **not checked** at the leader level
- Meeting **transcripts** (vs just summary) → **not checked**
- Slack / Basecamp activity → **not checked**
- General chats with Duncan → **not checked**

Email is only used at briefing-level (`email_pulse_signals.escalations`, `email_pulse_silent_leaders`). It does not contribute a "source" tick to your row in the Leadership grid. So if you spent the day in calendar meetings and on email but didn't move a card or release, today you'd show as **low_signal** or even **silent** — which is wrong.

### Fix: widen the leadership signal map to ~6 sources

Extend `computeLeaderSignalMap` in `supabase/functions/ceo-briefing/index.ts` to also pull:

```text
SOURCE                 SIGNAL                                          WINDOW
─────────────────────────────────────────────────────────────────────────────
meetings               participant / summary / title match (today)     7d
meeting_transcripts    leader name appears in transcript text          7d
workstream_cards       owner / assignee / title / comments mention     7d
azure_work_items       assigned_to / title / activity                  7d
releases               title / published_by                            14d
google_calendar        events where leader is organiser/attendee       7d  ← NEW
gmail (company opted)  sent count + received-with-reply count          7d  ← NEW
```

`signal_status` rules update accordingly:
- `active` ≥ 3 sources OR ≥ 2 execution sources (cards/azure/releases)
- `low_signal` = 1–2 non-execution sources only
- `silent` = 0 sources

A leader who is heads-down in calendar + email but produces no execution artefacts (cards / Azure / releases) becomes `low_signal` with explicit evidence — not falsely `silent`, and not falsely `active`. That's the honest read.

### What changes for you (Nimesh)

Section 04 entry will quote your actual signal mix, e.g.:

```text
NIMESH · CEO                                          ACTIVE · low risk
Sources: meetings · calendar · email · workstreams
Output: 4 calendar blocks today (KPL board prep, Patrick 1:1,
        Lightning Strike review), 12 emails sent incl. 2 board
        thread replies, 1 workstream card moved (KPL
        Registrations → amber → green).
Evidence chips: meetings, calendar, email, workstreams
```

vs today's "1 source · low_signal" miss.

### Files touched

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - computeLeaderSignalMap(): add calendar + gmail + transcript inputs
  - Loader: fetch google_calendar_events (7d) for opted-in leaders,
            fetch gmail aggregate counts from email_pulse per leader,
            fetch meeting_transcripts (7d, leader-name regex)
  - Update signal_status thresholds (≥3 sources OR ≥2 execution)
  - sources_detail gains "calendar" + "email" + "transcript" arrays
  - MORNING_SCHEMA_HINT (line 108): extend evidence_sources enum to
    include "calendar" and "email"

EDIT src/components/ceo/LeadershipGrid.tsx
  - sourceIcon(): add Calendar + Mail icons for the new chips
```

### Out of scope (ask if you want)

- Slack / Basecamp activity per leader (needs new aggregator)
- General Duncan chat usage as a leadership signal (privacy-sensitive — needs your call)
- Per-leader sentiment from email tone (separate model pass)

