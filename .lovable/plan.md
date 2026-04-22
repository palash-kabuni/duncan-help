
## Fix Azure Boards project duplication in Operations

### Exact issue
Yes — the same work item should not appear copied across multiple projects unless it truly belongs to each one, which Azure Boards work items do not.

The duplication is being introduced during sync in `supabase/functions/sync-azure-work-items/index.ts`, not in the Operations table UI.

### Root cause
There are two compounding problems in the sync function:

1. **The WIQL query is not explicitly scoped to the current project**
   - Current query:
   ```sql
   SELECT [System.Id]
   FROM workitems
   WHERE [System.ChangedDate] >= @Today - 30
   ORDER BY [System.ChangedDate] DESC
   ```
   - This does not include a `System.TeamProject` filter.
   - Result: each project loop can pull the same recently changed org-wide work item IDs.

2. **The synced row is labeled with the loop’s project name instead of the item’s real project**
   - Current code writes:
   ```ts
   project_name: project.name
   ```
   - But the actual project should come from the work item fields, e.g. `fields["System.TeamProject"]`.
   - Result: the same work item can be fetched repeatedly and then incorrectly stamped as belonging to every iterated project.

### Why the UI looks wrong
`src/pages/Operations.tsx` simply reads `azure_work_items` and shows:
- `external_id`
- `title`
- `project_name`

So if sync inserts the same Azure item multiple times with different `project_name` values, the Operations page will faithfully show those incorrect duplicates.

### Evidence in current code
- `src/pages/Operations.tsx`
  - reads directly from `azure_work_items`
  - no client-side duplication logic
- `supabase/functions/sync-azure-work-items/index.ts`
  - loops over all Azure projects
  - runs WIQL per project without `System.TeamProject`
  - batch-fetches item details
  - writes `project_name: project.name`
- `supabase/functions/azure-devops-webhook/index.ts`
  - already uses the correct source:
  ```ts
  project_name: resource.revision?.fields?.["System.TeamProject"] || null
  ```
  This confirms the sync function is the inconsistent part.

### What to change
1. **Scope WIQL to the current project**
   - Update the query to include:
   ```sql
   AND [System.TeamProject] = @project
   ```
   or the equivalent explicit project name condition for the current loop.

2. **Store the real project from the returned work item**
   - Replace:
   ```ts
   project_name: project.name
   ```
   with:
   ```ts
   project_name: fields["System.TeamProject"] || project.name
   ```

3. **Keep the existing composite uniqueness**
   - The table already has:
   ```sql
   UNIQUE (external_id, project_name)
   ```
   - Once project attribution is correct, this becomes meaningful instead of preserving bad duplicates.

4. **Clean up already-synced bad rows**
   - Add a migration or one-time cleanup to remove wrongly duplicated `azure_work_items` rows created by previous syncs.
   - Safest cleanup:
     - identify rows where the same `external_id` exists under multiple `project_name`s
     - keep the row whose `project_name` matches `raw_data->fields->System.TeamProject` when present
     - remove mismatched copies

5. **Optional hardening**
   - Store an additional canonical field such as `team_project` sourced from `System.TeamProject` for easier audits/debugging.
   - If desired, show that canonical project field in Operations instead of relying only on inferred labeling.

### Files to update
- `supabase/functions/sync-azure-work-items/index.ts`
- `supabase/migrations/...` for cleanup of bad duplicated rows
- optionally `src/pages/Operations.tsx` if you want to expose a clearer project/source field for verification

### Expected outcome
After the fix:
- a work item appears only under its real Azure project
- the same ID will no longer be duplicated across unrelated projects
- project filters in Operations will become trustworthy
- future syncs and webhook updates will align on the same project attribution model

## Technical detail
Current flawed flow:
```text
for each Azure project
  run broad WIQL
  fetch item details
  save item with project_name = loop project
```

Correct flow:
```text
for each Azure project
  run WIQL scoped to that project
  fetch item details
  save item with project_name = System.TeamProject
```
