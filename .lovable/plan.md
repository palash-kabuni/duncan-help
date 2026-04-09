

## Plan: Agentic Workstream Creation via Duncan Chat

### What This Enables
Users can describe a workflow or project to Duncan in natural language (e.g., *"Create the workflow for the Lightning Strike Event with cards for venue booking, marketing, and logistics"*), and Duncan will autonomously create the workstream cards, set statuses, assign people, add tasks, and organize everything under the correct project tag.

### Architecture

Duncan already has a multi-round tool-calling loop (up to 5 rounds) in `norman-chat`. We add new **write tools** for workstreams alongside the existing read-only analytics tools.

### New Tools to Add

| Tool | Purpose |
|------|---------|
| `create_workstream_card` | Create a card with title, description, status, project_tag, due_date, assignees (by name) |
| `add_tasks_to_card` | Add multiple tasks/checklist items to a card in one call |
| `update_workstream_card` | Update status, description, assignees, or due_date of an existing card |
| `list_team_members` | Look up available team members (names → user IDs) for assignment |

### System Prompt Update

Add instructions telling Duncan:
- When a user describes a workflow, project plan, or set of tasks, proactively break it down into workstream cards and tasks
- Use `list_team_members` first to resolve names to IDs before assigning
- Default project_tag from the fixed list: `Lightning Strike Event`, `Website`, `K10 App`, `School Integrations`
- Default status to `amber` (Yellow) for new cards unless specified
- Confirm the plan with the user before creating, or create directly if the user says "create" / "set up"

### Implementation Steps

1. **Add `WORKSTREAM_TOOLS` array** in `norman-chat/index.ts` — tool definitions for `create_workstream_card`, `add_tasks_to_card`, `update_workstream_card`, and `list_team_members`

2. **Add `executeWorkstreamTool` function** — handler that uses `supabaseAdmin` to:
   - Insert into `workstream_cards`, `workstream_card_assignees`, `workstream_tasks`, `workstream_activity`
   - Resolve user names to IDs via profiles table lookup
   - Return created card IDs so Duncan can chain task creation

3. **Register tools** in the tools assembly block (~line 2709) and the execution router (~line 2856)

4. **Update system prompt** (~line 28) with agentic workstream creation instructions

### Technical Details

- **File changed**: `supabase/functions/norman-chat/index.ts` only
- **No DB migrations needed** — all tables already exist
- **No RLS concerns** — edge function uses `supabaseAdmin` (service role)
- **Name resolution**: fuzzy match on `profiles.display_name` (case-insensitive ILIKE) so users can say "assign to Palash" without knowing IDs
- **Batch creation**: `add_tasks_to_card` accepts an array of tasks for efficiency within the tool-calling loop

### Example Interaction

**User**: *"Set up the workflow for the Lightning Strike Event. We need cards for Venue & Logistics (assign to Ellaine), Marketing & Comms (assign to Alex), and Budget & Sponsorship (assign to Nimesh). Each should have 3-4 relevant tasks."*

**Duncan**: Creates 3 cards under "Lightning Strike Event" project tag, assigns the right people, adds tasks to each, and confirms with a summary.

