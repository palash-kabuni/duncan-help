

## Route Duncan's AI workflows across OpenAI + Claude with cross-provider fallback

Goal: make Duncan use the right model for each job — Claude (claude-sonnet-4-5) for reasoning/synthesis/writing, OpenAI (gpt-4o) for everything else — with automatic cross-provider fallback when the primary fails.

### 1. Shared LLM router (new)

Create `supabase/functions/_shared/llm.ts` — a single helper used by all AI edge functions:

- `callLLM({ provider, messages, tools, tool_choice, max_tokens, temperature, response_format })`
  - `provider: "claude" | "openai" | "auto"` (auto = use the workflow's configured default)
  - Internally normalises both APIs to the OpenAI chat-completions response shape so callers don't change.
  - Translates OpenAI-style `tools` / `tool_choice` ↔ Anthropic `tools` / `tool_choice` (both already use JSON-Schema, mostly a key rename).
- `callLLMWithFallback(opts)` — tries the primary provider; on `429`, `5xx`, network error, or empty response, retries once on the other provider with the same messages/tools. Logs which provider served the request.
- `WORKFLOW_ROUTING` constant — single source of truth mapping each workflow → primary provider:

  ```ts
  export const WORKFLOW_ROUTING = {
    // Claude primary (reasoning, synthesis, writing)
    "norman-chat":          { primary: "claude",  fallback: "openai" },
    "ceo-briefing":         { primary: "claude",  fallback: "openai" },
    "ceo-email-pulse":      { primary: "claude",  fallback: "openai" },
    "analyze-meeting":      { primary: "claude",  fallback: "openai" },
    "finalize-release":     { primary: "claude",  fallback: "openai" },
    "generate-exec-summary":{ primary: "claude",  fallback: "openai" },
    "score-cv-values":      { primary: "claude",  fallback: "openai" },
    "score-cv-competencies":{ primary: "claude",  fallback: "openai" },
    "generate-jd":          { primary: "claude",  fallback: "openai" },
    "parse-jd-competencies":{ primary: "claude",  fallback: "openai" },
    "gmail-auto-draft":     { primary: "claude",  fallback: "openai" },
    "gmail-train-style":    { primary: "claude",  fallback: "openai" },
    "chat-with-project-context": { primary: "claude", fallback: "openai" },

    // OpenAI primary (vision, structured extraction from files, embeddings-adjacent)
    "extract-chat-file":    { primary: "openai",  fallback: "claude" },
    "extract-file-text":    { primary: "openai",  fallback: "claude" },
    "parse-cv":             { primary: "openai",  fallback: "claude" },
  } as const;
  ```

- Models used:
  - Claude primary: `claude-sonnet-4-5-20250929`. Same-provider degrade on retry inside Anthropic: `claude-haiku-4-5` (only if cross-provider also unavailable — belt and braces).
  - OpenAI primary: `gpt-4o`. Same-provider degrade: `gpt-4o-mini`.
- Embeddings (`text-embedding-3-small`) stay on OpenAI — Anthropic has no embeddings API. No change to RAG.

### 2. Migrate edge functions to the router

Replace each direct `fetch("https://api.openai.com/v1/chat/completions", …)` call in the 21 AI-using functions (excluding `test-claude` and embeddings calls) with `callLLMWithFallback({ workflow: "<function-name>", messages, tools, … })`. Behaviour preserved: same prompts, same tools, same response shape — only the transport changes.

Special cases:
- **`norman-chat`** (the monolith, 2,700+ lines, multi-round tool loop): swap the inner LLM call only. Tool-call loop, validation, and SSE streaming layer stay identical. Streaming path uses Anthropic's SSE format and gets normalised to OpenAI delta events so the existing client `streamChat` parser keeps working unchanged.
- **`chat-with-project-context`**: keep the OpenAI embeddings call for RAG retrieval; route only the chat completion through the router.
- **Vision / file parsing functions** stay OpenAI-primary because gpt-4o vision is the proven path here; Claude is fallback only.

### 3. Observability

- Log every call as `[llm] workflow=<name> provider=<used> attempt=<1|2> status=<ok|fallback|fail> latency_ms=<n>` so we can grep edge function logs to confirm routing is working.
- Update `mem://tech/llm-provider` to reflect the new dual-provider architecture and the `WORKFLOW_ROUTING` table as source of truth.

### 4. Verification

- Deploy all touched functions in one batch.
- Smoke tests via curl:
  - Trigger `test-claude` → confirms Claude key still healthy.
  - Trigger `ceo-briefing` (Claude primary) — check logs show `provider=claude status=ok`.
  - Trigger `parse-cv` (OpenAI primary) — check logs show `provider=openai status=ok`.
  - Force a fallback by temporarily passing an invalid Claude model in a one-off test call → confirm logs show `provider=openai status=fallback`.
- Confirm `/team-briefing` still generates correctly end-to-end.
- Confirm a chat message in Duncan still streams token-by-token (Claude SSE → OpenAI-delta normalisation works).

### Out of scope

- No client-side changes. No DB changes. No prompt rewrites.
- `test-claude` stays as-is (it's the connectivity smoke test).
- Embeddings, document text extraction, and ElevenLabs voice path are untouched.

### Risk + mitigation

- **Tool-calling schema mismatch** between providers → router translates and unit-checks shape before sending; if Claude rejects a tool schema, fallback fires automatically.
- **Streaming parser breakage** → router emits OpenAI-shaped `data: {choices:[{delta:{content}}]}` lines for both providers, so the existing frontend streaming code in `useNormanChat`/`chat` keeps working with zero changes.
- **Cost drift** from Claude on the chat hot path → log latency + provider; if costs spike we can flip `norman-chat` back to OpenAI in `WORKFLOW_ROUTING` in one line.

