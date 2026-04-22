
## Exact issue identified: Google Drive is wired as per-user in the UI, but implemented as a shared singleton in the backend

### Root cause
The Google Drive integration is currently inconsistent across the stack:

- In `src/pages/Integrations.tsx`, Google Drive is defined as:
  - `type: "user"`
  - connection status check = query `google_drive_tokens` where `connected_by = current user`
- But in the backend, Google Drive is implemented as a shared/singleton integration:
  - `supabase/migrations/20260208165300_c4d0bbfb-c747-456e-8fd6-d1d3c5518c9e.sql` creates a singleton `google_drive_tokens` table
  - `supabase/functions/google-drive-callback/index.ts` deletes all existing rows, then stores one fresh token
  - `supabase/functions/google-drive-api/index.ts` explicitly falls back to the most recent token if the current user has none

### What this means in practice
For any user who did not personally authorize Google Drive:

- the frontend checks `google_drive_tokens.connected_by = current user`
- that query returns empty
- the Integrations page shows Google Drive as disconnected / not working

But the backend is actually designed to allow shared access through the latest stored token.

### Evidence from the current code
1. Frontend per-user check:
   - `src/pages/Integrations.tsx`
   - `checkGoogleDriveConnection()`:
   ```ts
   supabase
     .from("google_drive_tokens")
     .select("id")
     .eq("connected_by", user.id)
   ```

2. Backend shared fallback:
   - `supabase/functions/google-drive-api/index.ts`
   - `getValidToken()`:
   ```ts
   .eq("connected_by", userId)
   ```
   then if none:
   ```ts
   .order("created_at", { ascending: false }).limit(1)
   ```

3. Singleton storage model:
   - `supabase/functions/google-drive-callback/index.ts`
   ```ts
   await supabaseAdmin.from("google_drive_tokens").delete()...
   await supabaseAdmin.from("google_drive_tokens").insert(...)
   ```

### Exact issue summary
The integration is not primarily failing because OAuth is broken.

The exact issue is:
- the frontend assumes Google Drive is a per-user integration
- the backend stores and serves it as a shared singleton integration
- so the UI connection check is wrong for most users

### Secondary inconsistencies found
These are not the main root cause, but they reinforce the problem:

- `google-drive-api` action `"status"` also checks only `connected_by = user.id`, so it can report disconnected even though shared fallback exists
- disconnect logic also deletes only the current user’s row, which is inconsistent with singleton/shared storage
- `src/pages/Integrations.tsx` calls `checkGoogleDriveConnection()` twice on mount
- there is a duplicated `else if (isGoogleDrive)` branch in the detail modal status logic

### Recommended fix
Align Google Drive to one model consistently.

Safest path, based on the existing backend:
1. Treat Google Drive as a shared/company-style integration in the UI
2. Change frontend connection status to check whether any valid shared Drive token exists, not only one owned by the current user
3. Update the modal copy so it reflects shared access behavior
4. Clean up the duplicate Google Drive conditionals and duplicate mount check
5. Optionally align backend `status` / `disconnect` behavior with the chosen shared model

### Scope of implementation
Files likely involved:
- `src/pages/Integrations.tsx`
- optionally `supabase/functions/google-drive-api/index.ts` if status/disconnect should match the shared model

### Expected outcome after fix
- Google Drive shows connected when the shared token exists
- users no longer see a false “not connected” state
- chat/report features that already rely on fallback behavior match what the Integrations UI displays
- connection/disconnection semantics become consistent across UI and backend

## Technical detail
This is an architecture mismatch, not just a rendering bug:

```text
Frontend model:      user-specific token required
Backend model:       singleton token + fallback to latest token
Observed result:     UI says disconnected while backend can still operate
```
