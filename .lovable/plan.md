

## Rename "CEO Briefing" → "Team Briefing", remove Send Team Actions, remove Evening briefing

Scope: UI/labelling only. Access remains restricted to Nimesh (no change to `isCEO` gate, route stays `/ceo`, DB tables stay named as-is to avoid breakage). Backend edge functions (`ceo-briefing`, `send-ceo-briefing-actions`, `ceo_briefings` table) are left intact — only the frontend is updated. The morning briefing becomes the only briefing; the briefing type is hard-coded to `"morning"`.

### 1. Rename to "Team Briefing"

- `src/pages/CEOBriefing.tsx` → page heading: "CEO Briefing" → **"Team Briefing"**.
- `src/components/Sidebar.tsx` → nav link label "CEO Briefing" → **"Team Briefing"** (icon and route unchanged).
- `src/components/settings/SettingsGmail.tsx` → opt-in card title "Include my inbox in the CEO briefing" → **"Include my inbox in the Team Briefing"** + matching body copy update.

(Internal identifiers — `CEOBriefing` component name, `useCEOBriefing` hook, `isCEO` access guard, `/ceo` route, `ceo_briefings` table — are left as-is to avoid regressions across the edge functions and RLS policies.)

### 2. Remove "Send Team Actions"

In `src/pages/CEOBriefing.tsx`:
- Remove the **Send team actions** button in the header.
- Remove the **"Last sent"** badge.
- Remove the `<SendActionsDialog>` mount at the bottom.
- Remove the `sendOpen` state, the `lastSent` state, and the `useEffect` that queries `ceo_briefing_email_logs`.
- Remove imports: `SendActionsDialog`, `Send` icon, and the `supabase` import if no longer used (it is still used for the `lastSent` query — once that is gone, drop the import too).

Delete files no longer referenced:
- `src/components/ceo/SendActionsDialog.tsx`

The edge function `supabase/functions/send-ceo-briefing-actions` and the `ceo_briefing_email_logs` table are **left in place** (deleting them is out of scope and risks breaking other call sites/migrations). They simply become unused.

### 3. Remove Evening briefing

In `src/pages/CEOBriefing.tsx`:
- Remove the `<Tabs>`/`TabsList`/`TabsTrigger` block (Morning/Evening switcher).
- Remove the `type` state; pass the literal `"morning"` to `useCEOBriefing`.
- Remove the `type === "morning"` / `type === "evening"` conditionals — keep only the morning render branch (sections 1–8: What Changed, Risk Radar, Friction, Leadership, Watchlist, Decisions, Automation Progress, Brutal Truth).
- Delete the `else` branch that rendered evening sections (Got Done / Slipped / New Risks / Ownership Gaps / Execution Score / Tomorrow Priorities).
- Remove `Tabs`/`TabsList`/`TabsTrigger` imports.

In `src/hooks/useCEOBriefing.ts`:
- Narrow `BriefingType` to `"morning"` only (keeps the type exported so the page import keeps working). The hook logic stays unchanged.

### 4. Verification

- Confirm no remaining imports of `SendActionsDialog` or references to `evening` in `src/`.
- Confirm `/ceo` still loads for Nimesh, shows "Team Briefing", renders the morning sections, and the Generate / Regenerate / Action routing controls still work.
- Sidebar link reads "Team Briefing"; Settings → Gmail opt-in copy reads "Team Briefing".

### Out of scope (intentionally not touched)

- DB table `ceo_briefings`, edge function `ceo-briefing`, `norman-chat` CEO mode, `isCEO` gate, route `/ceo` — renaming these would cascade into RLS, edge functions, and external schedulers and is unnecessary for the user-facing rename.
- `send-ceo-briefing-actions` edge function and `ceo_briefing_email_logs` table — left deployed but unused so no migrations or function deletions are required.

