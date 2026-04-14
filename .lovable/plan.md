

## Plan: Add Email Composition Rules to Duncan's Prompt Engine

### What Changes

**Single file**: `supabase/functions/norman-chat/index.ts`

### Change 1: Add email composition rules to SYSTEM_PROMPT

Insert a new section after line 29 (the Gmail Access capability description), within the existing prompt block. This adds explicit structural and tone rules for all emails Duncan composes:

```
When composing emails (via send_gmail_email):
- Subject: Clear, specific, max ~8 words. Must reflect purpose. Never use vague subjects like "Update" or "Quick note".
- Greeting: "Hi [First Name]," if known, otherwise "Hi,".
- Opening: First sentence states the purpose of the email.
- Body: Max 2-3 short paragraphs. Use bullet points only when listing 3+ items. Keep sentences concise.
- Closing: End with a clear next step or specific ask.
- Sign-off: "Best, [Sender Name]" — use the sender's display name from their profile.
- Tone: Professional but natural. Conversational, not robotic. Never sound like a template.
- Length: Under 150 words unless user requests more detail.
- NEVER use these phrases: "I hope this finds you well", "I wanted to reach out", "Please don't hesitate", "As per our discussion", "I'm writing to inform you".
- Do NOT overuse bullet points. Do NOT write long paragraphs.
- If user input is vague, infer a simple, clear email without adding unnecessary detail.
```

### Change 2: Update `send_gmail_email` tool description

**Line 844** — update the description to reinforce structure:

From:
> "Send an email from the user's Gmail account. Always confirm the details (to, subject, body) with the user before sending. Requires explicit confirmation."

To:
> "Send an email from the user's Gmail account. The body MUST follow the email composition rules: greeting, clear opening, concise body (max 2-3 paragraphs), closing with next step, and sign-off with sender name. Always confirm the draft with the user before sending. Requires explicit confirmation."

### Outcome
Every email Duncan drafts will follow: Greeting → Purpose → Content → Ask → Sign-off, with natural tone and no AI fluff.

