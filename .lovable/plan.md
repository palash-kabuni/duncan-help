

## Fix: `_shared/llm.ts` boot error — duplicate `const body` declaration

### Root cause

Lines 131-138 of `supabase/functions/_shared/llm.ts` contain the same `const body: any = { model, messages: opts.messages };` block twice in a row. Deno refuses to boot the module:

```
worker boot error: Uncaught SyntaxError: Identifier 'body' has already been declared
    at file:///var/tmp/sb-compile-edge-runtime/functions/_shared/llm.ts:111:9
```

Every edge function that imports the shared router (`ceo-briefing`, `norman-chat`, `analyze-meeting`, `gmail-auto-draft`, `hireflix-*`, etc.) fails to boot, which is why "Regenerate" on `/team-briefing` returns "Failed to send a request to the Edge Function" instantly with no logs from the function body itself.

### Fix — single edit

Delete the duplicate block (lines 135-138) in `supabase/functions/_shared/llm.ts`, keeping only the first `const body` declaration on lines 131-134. No other logic changes — the GPT-5 `max_completion_tokens` branch on lines 141-145 already operates on the surviving `body`.

### Redeploy

Redeploy every consumer of `_shared/llm.ts` so the corrected module is picked up:
`ceo-briefing`, `ceo-email-pulse`, `norman-chat`, `analyze-meeting`, `chat-with-project-context`, `gmail-auto-draft`, `gmail-train-style`, `generate-jd`, `parse-jd-competencies`, `score-cv-values`, `score-cv-competencies`, `finalize-release`, `generate-exec-summary`, `parse-cv`, `extract-chat-file`, `extract-file-text`, `hireflix-sync-interviews`, `hireflix-retry-processor`, `create-hireflix-position`.

### Verify

1. Tail `ceo-briefing` logs — confirm no `BootFailure` and a fresh `booted (time: …ms)` line.
2. Hit "Regenerate" on `/team-briefing` → expect `[llm] workflow=ceo-briefing provider=claude … status=ok` and a populated briefing.
3. Send a Duncan chat message → confirm streaming still works.

### Out of scope

No model changes, no timeout changes, no client changes. This is purely the syntax-error fix the previous edit introduced.

