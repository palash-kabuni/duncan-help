
Root cause: the selected-role CV fetch is still rejecting valid CV emails unless the message text explicitly mentions the role title. In `supabase/functions/fetch-gmail-cvs/index.ts`, once a role is selected, `classifyAttachmentBatch()` hard-requires a `roleSignal`, so emails like “Harry Freeman CV” are skipped even if they are clearly CV submissions. The current role fetch also only pulls the first 100 Gmail search results and does not paginate, so “all CVs for a role” is not guaranteed.

## What I’ll change

1. Make selected-role fetch trust the selected role
- When the user clicks `Fetch CVs` for `Operations Manager`, treat that chosen role as the assignment target.
- Stop requiring the email subject/snippet/filename to contain `Operations Manager`, `Ops Manager`, etc. for acceptance.
- Keep CV/recruitment heuristics, but use role-term matching as a relevance signal, not a hard rejection gate, when a role is already selected.

2. Preserve non-CV protection
- Keep excluding obvious business/legal/operations documents such as agreements, trackers, invoices, tickets, and strategy docs.
- For selected-role mode, accept CV-like emails even when they only say things like:
  - `Harry Freeman CV`
  - `Resume attached`
  - `Application`
  - a personal intro plus attached CV
- Ensure the system still rejects clear non-recruitment attachments.

3. Assign the selected role directly during selected-role fetch
- If a role is explicitly selected, use that role ID for inserted candidates instead of depending on subject-based role matching.
- Keep the existing subject-based matching for non-selected/general ingestion flows.

4. Paginate Gmail search results for role fetches
- Replace the single `maxResults=100` request with pagination using `nextPageToken`.
- Continue fetching additional pages for role-specific runs up to a safe cap, so recent/valid CVs are not missed because of the first page cutoff.
- Include totals in logs/response so it’s clear how many Gmail messages were examined.

5. Improve diagnostics for skipped role fetches
- Add explicit logging for selected-role runs showing whether a message was skipped because it looked non-CV versus previously missing a role title.
- This will make it easy to verify Harry Freeman emails are being seen and whether they are accepted or filtered.

## Expected outcome
After this change, when you fetch CVs for `Operations Manager`:
- emails like `Harry Freeman CV` should be ingested even if they do not mention `Operations Manager`
- both manually sent Operations Manager CV emails should be assignable to that role through the selected-role flow
- the system should still avoid pulling obvious non-CV attachments
- the fetch should cover more than the first 100 matching emails

## Files to update
- `supabase/functions/fetch-gmail-cvs/index.ts`

## Technical details
- Relax `classifyAttachmentBatch()` for selected-role mode so `roleSignal` is optional
- Use `selectedRole.id` as the authoritative `job_role_id` during selected-role fetches
- Keep `matchRoleToSubject()` for broad/general mode only
- Add Gmail pagination via `nextPageToken`
- Keep duplicate detection, storage upload, orphan relinking, and parse trigger behavior unchanged
