

## Fix Company Pulse: make it RYG and server-authoritative

### What will change

The current **Company Pulse** is still too narrative-led. It is mentioning coverage counts in prose and letting the model infer the overall state. That is why it can still feel wrong.

Instead, Duncan should output:

- **Red / Yellow / Green**
- **why it is that status**
- **the evidence behind it**
- **what is driving the status up or down**

Coverage remains an input, but not the headline by itself.

### New behaviour

**Company Pulse becomes a deterministic status, not an AI opinion.**

For the morning CEO briefing, Duncan will compute an overall company pulse from the facts already being collected:

- priority coverage
- whether Lightning Strike has a real tracked workstream
- how many priorities are silent vs discussed but untracked
- recent workstream / Azure execution evidence
- major blockers from issues, sync failures, overdue finance signals, and missing ownership
- previous briefing trend

Then the UI will show something like:

```text
COMPANY PULSE: RED
Why: Only 1 of 6 priorities has an active workstream. Two priorities are being discussed but remain untracked. Three have no visible activity. This means leadership has weak execution visibility and cannot claim readiness with confidence.
```

### Status rules

Duncan will use clear guardrails:

```text
RED
- fewer than half of the 6 priorities have active workstreams, OR
- Lightning Strike itself is not properly tracked, OR
- multiple priorities are silent/unowned, OR
- major blockers are present across critical systems

YELLOW
- more work is visible, but ownership / tracking / execution is incomplete
- meaningful momentum exists, but there are still material gaps or elevated risk

GREEN
- all 6 priorities are covered by tracked workstreams
- execution evidence is current
- no major blockers materially threaten June 7 readiness
```

Important rule:
- **Green is impossible unless full priority coverage and healthy execution evidence exist**
- **1 of 6 coverage should always resolve to Red**

### Implementation

#### 1) Edge function: compute pulse status on the server
**File:** `supabase/functions/ceo-briefing/index.ts`

Add a new helper such as `computeCompanyPulse()` that returns:

```ts
{
  status: "red" | "yellow" | "green",
  label: "Red" | "Yellow" | "Green",
  reason: string,
  evidence: string[],
  blockers: string[],
  positive_signals: string[],
  confidence: "high" | "medium" | "low"
}
```

This will be computed from server-side facts before/after the AI call using:
- `coverage_summary`
- `coverage_gaps`
- `meeting_priority_signals`
- `available_workstreams`
- recent card / Azure activity
- recent issues / sync failures / overdue finance signals
- previous briefing trend

#### 2) Make AI explain the pulse, not invent it
Update the prompt so the model must treat `company_pulse_status` as authoritative.

New rule:
- `payload.company_pulse` must begin with the exact server status (`RED`, `YELLOW`, or `GREEN`)
- it must explain the server-computed reason
- it must not restate incorrect coverage counts
- it must not override the server status

Add a post-check:
- if the generated `company_pulse` does not align with `company_pulse_status`, overwrite it with a server-built sentence

That removes the hallucination path entirely.

#### 3) Add explicit pulse object to the saved payload
Persist a new field like:

```ts
payload.company_pulse_status
```

So the UI can render the status directly instead of relying on free text.

#### 4) UI: show an actual RYG company pulse card
**Files:**
- `src/pages/CEOBriefing.tsx`
- `src/components/ceo/PulseBanner.tsx`
- `src/components/ceo/CompanyPulseCard.tsx` (new)

Update the page so it clearly separates:

- **Company Pulse** = overall Red / Yellow / Green across the business
- **Trajectory** = readiness trajectory for June 7 / Lightning Strike

That avoids the current confusion where one badge is doing too many jobs.

Recommended layout:

```text
PulseBanner
  - Lightning Strike trajectory
  - Probability / Execution gauges

CompanyPulseCard
  - RED / YELLOW / GREEN badge
  - one-line reason
  - evidence bullets
  - blockers / action note
```

#### 5) Replace “3 out of 6” style headline prose
Coverage counts should stay in supporting evidence, not as the main pulse label.

So instead of:
- “3 out of 6 priorities…”

It becomes:
- “RED — execution visibility is weak because only 1 of 6 priorities has a formal workstream…”

### Expected result for your current state

Based on what you described, the next regenerated briefing should read as **Red**, not a loose coverage sentence.

Example:

```text
Company Pulse: RED

Why:
Only 1 of 6 non-negotiable priorities has a tracked workstream. Some related work may be happening in meetings, but it is not organised into owned execution tracks. That means the business is operating with weak visibility, fragmented accountability, and low confidence in June 7 readiness.
```

### Files to update

```text
EDIT supabase/functions/ceo-briefing/index.ts
  - add computeCompanyPulse()
  - inject company_pulse_status into prompt
  - enforce server-authoritative company_pulse text
  - save payload.company_pulse_status

NEW src/components/ceo/CompanyPulseCard.tsx
  - render RYG badge, reason, evidence, blockers

EDIT src/pages/CEOBriefing.tsx
  - render CompanyPulseCard
  - separate overall Company Pulse from June 7 trajectory

EDIT src/components/ceo/PulseBanner.tsx
  - keep trajectory focused on Lightning Strike readiness only
  - avoid mixing overall company-health semantics into this badge

EDIT mem://features/ceo-operating-system.md
  - document server-authoritative RYG company pulse rules
```

### Outcome

After this change:
- Company Pulse will no longer be vague prose
- Duncan will say **Red / Yellow / Green** clearly
- the reason will be grounded in facts
- coverage counts become evidence, not the headline
- trajectory and overall business pulse will no longer be conflated

