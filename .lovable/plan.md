

## Expand Daily Briefing to Scan All Systems

### Current Coverage (4 sources)
- Meetings + action items (last 48h)
- Azure DevOps work items assigned to user
- Xero outstanding invoices
- Basecamp to-dos

### Missing Sources to Add

1. **Google Calendar** — Today's upcoming events so the user knows their schedule
2. **Purchase Orders** — POs the user submitted (pending/approved) and POs awaiting their approval
3. **Issues/Feedback** — Any issues submitted by or relevant to the user
4. **Candidates/Recruitment** — Recent candidate updates for jobs the user created
5. **NDA Submissions** — Any NDAs the user submitted and their status
6. **Basecamp Messages** — Recent messages mentioning the user (not just to-dos)
7. **Wiki Updates** — Recently updated wiki pages relevant to the user's department
8. **Xero Contacts with Overdue Balances** — Flag any contacts with overdue amounts

### Implementation

**File: `supabase/functions/daily-briefing/index.ts`**

Add 5 new parallel queries to the existing `Promise.all`:
- `google_calendar_tokens` → if user has a token, call `google-calendar-api` to fetch today's events
- `purchase_orders` where `requester_id = user.id` or pending approval in user's department (last 7 days)
- `issues` where `user_id = user.id` (recent, last 7 days)
- `candidates` joined with `job_roles` where `created_by = user.id` and recently updated
- `nda_submissions` where `submitter_id = user.id` and status != 'completed'

Also expand Basecamp fetching to include recent messages (via message boards) that mention the user's name.

Add all new data sections to the briefing JSON response:
```
calendar: { todays_events: [...] }
purchase_orders: { my_pending: [...], awaiting_my_approval: [...] }
issues: { my_recent: [...] }
recruitment: { active_candidates: [...] }
ndas: { pending: [...] }
basecamp: { my_todos: [...], messages_mentioning_me: [...] }
```

**File: `supabase/functions/norman-chat/index.ts`**

Update the briefing mode system prompt to include new sections:
- 📅 Today's Calendar
- 📋 Purchase Orders needing attention
- 🐛 Issues & Feedback
- 👥 Recruitment updates
- 📝 NDA status
- 💬 Basecamp messages mentioning the user

### Technical Details
- All new queries run in parallel via `Promise.all` — no performance impact on existing queries
- Google Calendar fetch reuses the existing `google-calendar-api` edge function proxy
- User matching uses `user.id` for DB records and `displayName` for text-based matching (Basecamp messages, meeting action items)
- Graceful fallback: if any source returns no data or errors, it's reported as "No updates" rather than failing the whole briefing

