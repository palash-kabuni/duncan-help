
## UI-only plan: hide Azure Blob Storage, Azure DevOps, and Basecamp cards from Integrations

### What will change
Remove the three integration options from the frontend display in the Integrations page only:

- Azure Blob Storage
- Azure DevOps
- Basecamp

No backend, database, auth, RLS, or edge-function behavior will be touched.

### Current implementation
The Integrations page is driven by a static `integrations` array in `src/pages/Integrations.tsx`. That array currently includes all visible cards, categories, counts, and modal entry points.

Because the page derives its UI from that array:
- removing entries there will hide the cards
- the category filter list will automatically update
- connected counts shown on the page will automatically exclude those hidden cards
- no backend changes are required

### Fastest implementation path
1. Update `src/pages/Integrations.tsx`
   - Remove or filter out these three entries from the `integrations` array:
     - `azure-blob`
     - `basecamp`
     - `azure-devops`

2. Keep everything else intact
   - Do not touch:
     - connection-check functions
     - company/user integration hooks
     - backend calls
     - database logic
     - modal logic for other integrations

3. Verify frontend behavior
   - `/integrations` no longer shows those three cards
   - remaining cards still render normally
   - category chips still look correct
   - clicking remaining cards still opens the detail modal

### Included
- Hide the three specified cards from the Integrations grid
- Preserve all existing behavior for visible integrations
- Keep the change scoped to frontend display only

### Deferred / intentionally not changed
- No cleanup of unused backend connection checks
- No removal of hidden integrations from backend tables
- No deletion of modal branches or OAuth handlers unless clearly necessary for type/build safety
- No sidebar or other page changes unless those cards are also rendered there by this same page flow

### Technical notes
- `categories` is derived from the visible `integrations` array, so it should self-correct after the change.
- `connectedCount` is also derived from that same array, so it will reflect only visible integrations.
- The safest minimal implementation is to change only the display source list, not the backend state machinery.

### Validation checklist
After implementation, confirm:
1. Integrations page loads without errors
2. Azure Blob Storage card is gone
3. Basecamp card is gone
4. Azure DevOps card is gone
5. Gmail / Google Calendar / Google Drive / Slack still display normally
6. Clicking a remaining integration still opens its detail view
7. No regression in page layout or filter chips

### Expected outcome
A minimal UI-only update where those three integrations still exist in the system backend, but are no longer shown as selectable options in the Integrations section.
