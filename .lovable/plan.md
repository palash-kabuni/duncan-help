
## Projects Collaborate MVP — trimmed plan

### Fastest path to working MVP
Ship the smallest possible version of collaboration:

```text
owner creates project
→ owner adds teammate
→ teammate sees project in /projects
→ teammate opens shared workspace
→ teammate can view existing chats
→ teammate can send messages in shared project chat
```

This keeps scope tightly limited to:
- `projects`
- `project_members` (new)
- `project_chats`
- `chat_messages`
- minimal UI in `ProjectWorkspace.tsx`

---

## What is INCLUDED in MVP

### 1) Minimal data model
Add one table only: `project_members`

Recommended minimal structure:
- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null`
- `user_id uuid not null`
- `added_by uuid not null`
- `created_at timestamptz not null default now()`
- `unique (project_id, user_id)`

Why this is enough:
- `projects.user_id` already represents the owner
- collaborators only need membership rows
- no roles, invites, statuses, or approval flow needed

Notes:
- `user_id` should align with existing `profiles.user_id`
- owner does not need to be inserted into `project_members`

---

### 2) Simplest access control
Do not add SQL helper functions.

Update RLS directly and only where required for MVP.

#### `projects`
Keep existing owner access, plus allow `SELECT` for collaborators via `project_members`.

MVP effect:
- owners still fully control their own projects
- collaborators can see projects they were added to

#### `project_chats`
Keep existing owner access, plus allow collaborators to:
- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE` only if needed for existing UI behavior

For speed, simplest MVP is:
- allow collaborators full chat-table access on chats whose `project_id` belongs to a project where they are in `project_members`

#### `chat_messages`
Keep existing owner access, plus allow collaborators to:
- `SELECT`
- `INSERT`
- `DELETE` only if current UI needs it

For MVP, the critical actions are:
- read messages
- insert messages

That is enough for shared chat to work.

#### `project_members`
Add simple policies:
- owner can `SELECT`, `INSERT`, `DELETE` membership rows for their own projects
- collaborators can `SELECT` membership rows for projects they belong to

No update policy needed.

---

### 3) Backend scope reduction
Keep backend changes minimal.

#### Add one hook only
Add `useProjectMembers(projectId)` in `src/hooks/useProjects.ts`

Responsibilities:
- fetch current collaborators for a project
- fetch matching profile details from `profiles`
- insert new member row
- remove member row
- expose loading state

Keep the shape simple:
- `members`
- `loading`
- `addMember(userId)`
- `removeMember(userId)`
- `refetchMembers()`

No extra abstraction layer.

#### No new edge functions
For MVP, do member management directly with Supabase client calls from the hook.

That matches existing project hook patterns and is fastest.

---

### 4) Frontend changes
Keep UI extremely small and place it where it matters most: inside the active workspace.

#### Placement
Add a `Collaborate` button in `src/pages/ProjectWorkspace.tsx` header, next to `Files` and `Settings`.

#### Dialog contents
Open a small dialog with only:
1. Add member dropdown
2. Current member list
3. Remove button for collaborators

#### User selection
Reuse existing approved profile source from `useUserProfiles()` in `src/hooks/useWorkstreams.ts`.

Dropdown behavior:
- list approved users
- exclude project owner
- exclude already-added members

Displayed fields:
- display name
- role title
- avatar if easy to reuse
- otherwise name only is fine for MVP

#### Members display
Inside the dialog:
- owner shown first with `Owner` label
- collaborators listed below
- `Remove` action on collaborators only

#### Empty state
If no collaborators yet:
- show owner only
- text: “Only you have access to this project right now.”

---

## Chat + file assumptions

### Chat
Project chat will work once access is enabled to:
- `projects`
- `project_chats`
- `chat_messages`

Why:
- chat is already scoped by `project_id` / `chat_id`
- `ProjectWorkspace.tsx`, `useProjectChats`, `useProjectChat`, and `chat-with-project-context` already operate on shared project-linked records
- current blocker is owner-only RLS, not chat architecture

So for chat, no redesign is needed.

### Files
Files will **not automatically become fully shared** in this first MVP.

Reason:
- `project_files` RLS is still owner-only
- `project_file_chunks` is still owner-only
- `upload-project-file` currently checks project access via `projects`, but file table/storage access is still owner-scoped

So the fastest path is:
- do not include shared files in this MVP
- keep focus on shared project visibility + shared chat

That avoids breaking file behavior while shipping collaboration quickly.

---

## What is DEFERRED

Explicitly out of scope for the first build:
- member roles / permissions
- invites / pending states / emails
- shared file access
- project file uploads by collaborators
- project file deletion by collaborators
- project settings editing by collaborators
- ownership transfer
- audit logs
- helper SQL functions
- extra hooks beyond `useProjectMembers`

---

## Shortest implementation order

### Step 1
Create `project_members` table with:
- `project_id`
- `user_id`
- `added_by`
- `created_at`
- unique `(project_id, user_id)`

### Step 2
Add RLS for `project_members`:
- owner can add/remove/view members
- collaborator can view their own project membership

### Step 3
Update `projects` SELECT policy:
- existing owner access stays
- collaborator access added through `project_members`

### Step 4
Update `project_chats` policies:
- allow collaborator read/create/update as needed for workspace chat list

### Step 5
Update `chat_messages` policies:
- allow collaborator read/insert so shared chat works

### Step 6
Add `useProjectMembers(projectId)` to `src/hooks/useProjects.ts`

### Step 7
Add simple `Collaborate` dialog to `src/pages/ProjectWorkspace.tsx`

### Step 8
QA the flow:
- owner adds member
- member sees project
- member opens project
- member sees chats
- member sends chat message
- owner sees the shared message

---

## MVP validation checklist

### Owner flow
- create project
- open workspace
- open Collaborate dialog
- add approved user
- see user appear in members list

### Collaborator flow
- log in as added user
- see project in `/projects`
- open shared workspace
- view existing chat threads
- open a thread
- send a message successfully
- see assistant response persist in shared thread

### Removal flow
- owner removes collaborator
- collaborator no longer sees project in `/projects`
- collaborator loses access to project chats

### Duplicate protection
- adding same user twice is blocked by unique constraint
- UI should surface a simple “Already a member” message

---

## Bottom line
The fastest safe MVP is:

- one new table: `project_members`
- direct RLS updates only on:
  - `projects`
  - `project_members`
  - `project_chats`
  - `chat_messages`
- one new hook: `useProjectMembers`
- one simple Collaborate dialog in `ProjectWorkspace.tsx`

This gets to a working:
`add member → shared project visibility → shared project chat`
with the least schema, least UI, and least risk to existing functionality.
