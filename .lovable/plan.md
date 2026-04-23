
## Plan

Add a project collaborator notification email that sends from Duncan immediately after a collaborator is successfully added to a project.

### What I’ll build
1. Add a backend-powered app email flow for “project collaborator added”.
2. Trigger that flow only after the existing `project_members` insert succeeds.
3. Send the email to the added collaborator with project-specific context:
   - project name
   - who added them
   - a link back to the project
4. Keep the current project-sharing UI and success/error behavior unchanged.

### What I found in the current code
- Collaborators are added in `src/hooks/useProjects.ts` inside `addMember(...)`.
- The member is inserted directly into `project_members`, then the UI refreshes members and shows:
  - “Member added”
  - “Project access has been shared.”
- The project workspace calls that hook from `src/pages/ProjectWorkspace.tsx`.
- The `profiles` shape currently includes display/profile fields, but no email field is exposed in app types.
- I did not find existing app email sending code or existing email template files in this repo, so this will likely require setting up the app email infrastructure first.

### Implementation approach
1. **Set up app email capability**
   - If the project does not already have branded app email configured, set that up first so Duncan can send emails from the project’s sender identity.

2. **Create a collaborator-invite notification template**
   - Add a branded Duncan email template for project access notifications.
   - Keep the copy short and practical:
     - subject: project access granted
     - body: who shared it, which project, direct link

3. **Add a backend send path**
   - Use a backend function to send the notification so recipient resolution and sending stay secure.
   - The backend will:
     - validate the requester
     - verify the requester actually has rights to share that project
     - fetch the added collaborator’s email address
     - fetch project name and inviter display name
     - send the email using the template

4. **Trigger after successful collaborator add**
   - Update the existing add-member flow so that after `project_members` insert succeeds, it also calls the backend notification sender.
   - Keep this after the successful insert so no email is attempted for failed or duplicate adds.

5. **Failure behavior**
   - The project-sharing action should remain the primary action.
   - If the email send fails, the collaborator should still remain added.
   - The UI can either:
     - stay silent on email failure, or
     - show a lightweight non-blocking notice that access was granted but email failed

### Important technical detail
- The current frontend-accessible `profiles` data does not include collaborator email addresses.
- To send the notification reliably, the backend must resolve the recipient email from the authentication user record or another trusted backend-side source.
- That means this should be implemented as a backend email trigger, not a frontend-only email send.

## Files likely involved
- `src/hooks/useProjects.ts` — trigger notification after successful member insert
- one backend email sender function
- app email template files for the notification
- possibly one small shared helper if the project’s email setup follows that pattern

## Technical details
- **Trigger point:** after successful `project_members` insert in `addMember(...)`
- **Recipient:** newly added collaborator
- **From:** Duncan / project sender identity
- **Security:** backend validates caller and project access before sending
- **Data used in email:** project name, inviter name, project link
- **Non-blocking behavior:** email failure must not roll back collaborator access
- **No change to core UX:** existing member add flow and toasts remain intact except for optional email-status feedback

## Expected outcome
When someone adds a collaborator to a project, the collaborator is granted access as they are today, and they also receive a Duncan email telling them they’ve been added and linking them into the project.
