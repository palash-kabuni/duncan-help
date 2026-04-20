

## Issue
The auto-draft worker successfully created 1 draft (per logs), but Gmail shows it blank.

## Root cause
The draft MIME message is built as **single-part `text/html` only**. Gmail's web compose editor preferentially loads the `text/plain` part of a draft into the editor — when only `text/html` exists, the editor often renders blank even though the HTML content is present in the raw message.

Additionally, the `From:` header is set to a bare lowercased email (`myEmail`) rather than the proper address from the token row, which can also confuse Gmail's draft validation.

## Fix
In `supabase/functions/gmail-auto-draft/index.ts`, rebuild the draft as a `multipart/alternative` MIME message with both `text/plain` and `text/html` parts:

1. Replace the single-part header block (lines 260-270) with a proper multipart construction:
   - Outer headers: `From`, `To`, `Subject`, `In-Reply-To`, `References`, `MIME-Version`, `Content-Type: multipart/alternative; boundary="..."`
   - Part 1: `text/plain; charset=UTF-8` with the raw `draftBodyText`
   - Part 2: `text/html; charset=UTF-8` with the `<br>`-converted HTML
2. Use the original-case email from `tokenRow.email_address` for the `From:` header (don't lowercase).
3. Keep base64url encoding of the full assembled message.

## Files
- `supabase/functions/gmail-auto-draft/index.ts` — rewrite MIME assembly (lines ~252-281)

## Verification
After deploy, manually trigger the function via the test tool, then open Gmail Drafts — the new draft should display the `[Auto-drafted by Duncan — review before sending]` prefix plus the generated reply in the editor.

## Notes
- Existing blank draft can be deleted manually from Gmail.
- Duncan label was applied, so that thread won't be re-drafted automatically. To re-draft for testing, remove the `Duncan/Auto-Drafted` label from the message in Gmail first.

