

## Personalized Login Briefing from Duncan

### What it does
When a user logs in (once per session), Duncan automatically generates a personalized company briefing covering:
- Emails handled by Duncan (drafted, replied)
- Relevant Slack messages
- Meeting summaries with action items assigned to the user
- Key updates from Basecamp/Azure DevOps relevant to the user

### Architecture

```text
Login → Index page loads → Session check (sessionStorage) 
  → If first visit this session:
      1. Create a new edge function "daily-briefing" that queries across systems
      2. Auto-send a briefing prompt to norman-chat
      3. Display the response as the first message
```

### Implementation Plan

**1. Create `supabase/functions/daily-briefing/index.ts`**

A new edge function that aggregates cross-system data for the logged-in user:
- Query `meetings` table for recent meetings (last 24-48h) with action items assigned to the user
- Query `xero_invoices` for any outstanding items relevant to the user
- Query `azure_work_items` for items assigned to the user that changed recently
- Query Basecamp via the existing proxy for recent to-dos assigned to the user
- Return a structured JSON summary

**2. Update `src/pages/Index.tsx`**

- On first load per session (using `sessionStorage` flag, separate from the welcome modal), automatically trigger a briefing request
- Instead of building a separate UI, send a structured prompt to `norman-chat` like: *"Generate my personalized morning briefing. Here is the latest data: {briefing_data}"*
- This leverages Duncan's existing reasoning capabilities to produce a natural, personalized summary
- The briefing appears as the first assistant message in the chat

**3. Update `src/hooks/useNormanChat.ts`**

- Add a `sendBriefing` method that sends the briefing prompt without adding a visible user message (so it looks like Duncan proactively speaks)
- The assistant response streams in naturally as the first message

**4. Update `supabase/functions/norman-chat/index.ts`**

- Add a `daily_briefing` tool that the chat can call, or accept a `mode: "briefing"` that automatically gathers cross-system data
- When mode is "briefing", the system prompt is augmented with: "Generate a concise, personalized morning briefing for this user covering: meetings & action items, recent relevant messages, project updates, and any items needing attention"

### Technical Details

- **Session gating**: `sessionStorage.getItem("duncan_briefing_shown")` prevents repeat triggers
- **Data sources**: meetings table (action_items JSON), azure_work_items (assigned_to), xero_invoices (status), Basecamp to-dos
- **User matching**: Uses the user's email and profile display_name to match across systems (e.g., `assigned_to` in Azure DevOps, action items in meetings)
- **Performance**: The briefing edge function runs all queries in parallel (`Promise.all`) and returns within 2-3 seconds; the norman-chat then synthesizes it
- **Fallback**: If no data is available for any source, Duncan gracefully notes "No recent updates" for that section

### Files to create/modify
- **Create**: `supabase/functions/daily-briefing/index.ts`
- **Modify**: `src/pages/Index.tsx` — auto-trigger briefing on session start
- **Modify**: `src/hooks/useNormanChat.ts` — add `sendBriefing()` method
- **Modify**: `supabase/functions/norman-chat/index.ts` — add briefing mode/tool

