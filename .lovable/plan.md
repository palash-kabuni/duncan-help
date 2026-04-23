
Diagnosed cause: the current CV ingestion flow is not actually scoped to “recent CVs for Operations Manager”.

## What is happening now
1. The `fetch-gmail-cvs` function searches Gmail with a very broad query:
   - `has:attachment (filename:pdf OR filename:docx OR filename:doc)`
   - capped at `maxResults = 50`
2. After that, it only links an email to the selected role if the email subject matches the role title (`Operations Manager`) using subject-based matching.
3. In the live data, recent messages are mostly operational/legal documents, agreements, tournament forms, and similar attachments — not CV emails with a subject matching `Operations Manager`.
4. That is why the system is currently creating many `parse_failed` records from unrelated documents instead of surfacing recent Operations Manager candidates.

## Evidence from the app/backend
- Active role exists:
  - `Operations Manager` is present and active.
- Existing Operations Manager candidates do exist, but they are older:
  - latest linked candidates are from `2026-04-17`
- Over the last 3 days the ingestion produced:
  - `650 parse_failed`
  - `233 parsed`
  - only `2 unmatched`
- Recent subjects being ingested are things like:
  - `Tournament Update – School Confirmations...`
  - `Legal & Ops Tracker`
  - `Agreement UPDATES`
  - `Kabuni Supplier Agreement`
- These are being caught because the Gmail search is too broad, and many attachments are not CVs at all.

## Root cause
The bottleneck is the ingestion logic in `supabase/functions/fetch-gmail-cvs/index.ts`, not the Operations Manager role itself.

Specifically:
- search is too broad
- results are limited to the first 50 matching Gmail messages
- role assignment depends on subject text matching the role title
- “Operations” / “Ops” business documents are being mistaken for candidate attachments because they are PDFs/DOCs

## What to change
1. Tighten the Gmail search when a role is selected
- Build a role-aware Gmail query instead of the global attachment query.
- For Operations Manager, search should require both:
  - attachment presence
  - role-related subject/body terms
- Example direction:
  - role title terms
  - recruiting terms like `cv`, `resume`, `application`, `candidate`

2. Add stronger CV filtering before ingest
- Reject obvious non-CV attachments and business documents earlier.
- Use filename + subject heuristics before upload/parse.

3. Improve matching beyond exact subject-title overlap
- Support common variants:
  - `Ops Manager`
  - `Operations`
  - `Application for Operations Manager`
  - `CV - Operations Manager`

4. Reduce false positives from legal/ops documents
- Add exclusion heuristics for terms like:
  - agreement
  - supplier
  - tracker
  - tournament
  - consent form
  - invoice
  - framework

5. Preserve current manual role flow
- Keep the selected-role fetch UX as it is.
- Only improve the backend query and pre-ingest filtering.

## Expected outcome after fix
When you click `Fetch CVs` for Operations Manager, Duncan should:
- scan fewer irrelevant attachment emails
- stop ingesting legal/ops docs as fake candidates
- correctly pick up recent candidate CVs tied to the Operations Manager role
- show materially fewer `parse_failed` records caused by non-CV documents

## Files to update
- `supabase/functions/fetch-gmail-cvs/index.ts`

## Implementation details
- Replace the broad Gmail query with a role-aware query when `role_id` is provided.
- Add a helper to generate alias terms from the role title.
- Add pre-ingest exclusion rules for obvious non-recruitment documents.
- Keep existing duplicate handling, orphan relinking, storage upload, and parse trigger behavior unchanged.
