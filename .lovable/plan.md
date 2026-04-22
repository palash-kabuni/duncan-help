

## Goal
Make the **Email Pulse card** honest and self-explanatory: clarify what each metric means, separate "opted out" from "not connected" from "silent", and always show real names.

## What's wrong today

1. **"Risks" and "Board / customers" labels are unexplained.**
   - `risks` = high-signal risks the LLM extracted from the last 24h of emails (severity low/medium/high/critical), filtered to things that touch a 2026 priority or finance/legal/customers.
   - `board / customers` = count of `board_mentions` (any email referencing investors, board members, or board materials) over count of `customer_issues` (emails flagging a customer problem).
   - Today these labels are shown without tooltips or definitions, so they read as opaque jargon.

2. **"3 opted out" expands to email-only / no names.**
   - `opted_out_mailboxes` is built **only** from `gmail_tokens` rows where `gmail_writing_profiles.ceo_briefing_optin = false`.
   - It joins to `profiles.display_name`, but if that field is null/empty the card renders just the email (or nothing).
   - It does **not** include team members who have never connected Gmail — those people silently disappear from the count.

3. **"Silent leaders" mixes three very different states.**
   - Today, the `LEADERSHIP` roster (Nimesh, Patrick, Ellaine, Matt, Alex, Simon, Palash, Parmy) is checked against connected mailboxes. Anyone without a connected/opted-in mailbox is dropped into `silent_leaders` with reason `"mailbox not connected or not opted in"`.
   - That collapses three meaningfully different states into one bucket:
     - a) Connected + opted in + 0 outbound emails in 24h → genuinely silent
     - b) Connected + opted out → deliberate privacy choice
     - c) Never connected Gmail at all → infrastructure gap, not a behaviour signal
   - Result: Alex and Parmy show up under "Silent leaders" even though Parmy is actually opted out and Alex has just never connected Gmail. That's misleading.

## Fix

### 1. `supabase/functions/ceo-email-pulse/index.ts`
- Build a single **`leadership_status`** array, one row per leader in `LEADERSHIP`, with an explicit state:
  - `silent` → connected + opted in + 0 sent in 24h
  - `opted_out` → connected but opted out
  - `not_connected` → no `gmail_tokens` row matching their leadership email
  - `active` → connected + opted in + ≥1 sent
  - `error` → token failed / mailbox error
- Each row carries `leader`, `email`, `state`, and a short human reason.
- Replace `silent_leaders` with this richer `leadership_status` (keep `silent_leaders` as a backwards-compatible derived view = `leadership_status.filter(state === 'silent')` so existing briefing logic still works).
- Strengthen `opted_out_mailboxes`:
  - Always join `profiles.display_name`.
  - If `display_name` is null, fall back to the email's local-part, capitalised (e.g. `parmy@kabuni.com` → `Parmy`).
  - Add `state: "opted_out"` to each row for symmetry with the new structure.

### 2. `supabase/functions/ceo-briefing/index.ts`
- In the `email_pulse` payload block (~lines 3334–3360), pass through the new `leadership_status` array alongside the existing `silent_leaders`.
- Keep `silent_leaders` unchanged so the rest of the briefing prompt logic (the rule that escalates a leader to high-risk if they're silent in both `email_pulse_silent_leaders` and `leader_signal_map`) keeps working without further changes.

### 3. `src/components/ceo/EmailPulseCard.tsx`
- Add the new `leadership_status` field to `EmailPulseSummary`.
- Replace the single "Silent leaders" amber block with a **three-row Leadership status panel**:
  - **Silent** (amber) → connected + opted in + 0 sent
  - **Opted out** (muted) → deliberately not scanning
  - **Not connected** (muted, with a "Connect Gmail" hint) → no gmail token at all
  - "Active" leaders are not shown (they're the default healthy state).
- Each row shows leader name + email; clicking the row expands a one-line reason.
- Above the metric grid, add small `Tooltip` hovers on the four column headers explaining:
  - **Mailboxes** → connected Gmail accounts that are opted in / out of the pulse
  - **Commitments** → concrete promises an owner made in email in the last 24h
  - **Risks raised** → material risks surfaced in email (severity ≥ medium counts toward critical)
  - **Board / Customers** → count of board-related mentions vs customer-issue mentions
- Keep the existing "(N opted out)" expander but use the now-guaranteed display name from the backend so names always appear.

## Files touched
- `supabase/functions/ceo-email-pulse/index.ts` — add `leadership_status`, harden `opted_out_mailboxes` name fallback.
- `supabase/functions/ceo-briefing/index.ts` — pass `leadership_status` through into `payload.email_pulse`.
- `src/components/ceo/EmailPulseCard.tsx` — three-state leadership panel, header tooltips, name fallbacks.

## Out of scope
- No schema changes.
- No new "active leaders" or directory expansion beyond the existing `LEADERSHIP` roster — if the user later wants to show every Duncan user (not just the 8 leaders), that's a separate roster decision.
- No change to who is opted in/out.

