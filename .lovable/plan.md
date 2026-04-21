

## Upgrade Duncan to latest Claude Opus + GPT-5 models

Confirmed: both your keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are configured and Duncan's edge functions already call them **directly** (not via the Lovable AI Gateway). Only the model identifiers need updating.

### 1. Update model constants

In `supabase/functions/_shared/llm.ts` (lines 57-60), swap the four model identifiers:

| Slot | Current | New |
|---|---|---|
| Claude primary | `claude-sonnet-4-5-20250929` | **`claude-opus-4-5`** (latest Opus, since "4.7" doesn't exist) |
| Claude degrade | `claude-haiku-4-5` | `claude-sonnet-4-5-20250929` (Sonnet becomes the cheaper fallback within Anthropic) |
| OpenAI primary | `gpt-4o` | **`gpt-5`** |
| OpenAI degrade | `gpt-4o-mini` | `gpt-5-mini` |

Embeddings stay on `text-embedding-3-small` (Anthropic has no embedding API; this is unchanged).

### 2. Keep file-parsing path on a vision-capable model

`parse-cv`, `extract-chat-file`, `extract-file-text` currently force OpenAI because they send `type: "file"` content blocks. They'll automatically use `gpt-5`, which supports vision — no code change needed beyond the constant swap.

### 3. Deploy + smoke test

- Deploy all 18 AI edge functions in one batch.
- Hit `test-claude` to confirm Opus key path works.
- Trigger `/team-briefing` (Claude Opus primary) → check logs show `provider=claude model=claude-opus-4-5 status=ok`.
- Send a chat message to Duncan → confirm streaming still works end-to-end via Opus SSE → OpenAI-shaped delta normalisation.
- Trigger `parse-cv` with a sample CV → confirm `gpt-5` vision works.

### 4. Update memory

Refresh `mem://tech/llm-provider` with the new model identifiers and the rationale (Opus for reasoning depth, GPT-5 for OpenAI-side workloads + vision).

### Notes on your request

- **"Opus 4.7"**: doesn't exist in Anthropic's catalogue today. The latest published Opus is **4.5** — that's what I'll wire in. If Anthropic ships a newer Opus, it's a one-line change.
- **Cost / latency caveat**: Opus is ~5× the cost of Sonnet and noticeably slower on the chat hot path. If `norman-chat` feels sluggish or burns budget, we can flip just `norman-chat` back to Sonnet in `WORKFLOW_ROUTING` while keeping Opus on the heavy synthesis workflows (briefings, exec summaries, CV scoring). Tell me if you want that split now or after you've felt the latency.
- **GPT-5 access**: assumes your OpenAI org has `gpt-5` enabled. If the deploy logs show a 404 model-not-found, we'll fall back to `gpt-4o` automatically via the cross-provider fallback (Claude Opus picks up the slack), and I'll switch the constant to whatever your account allows.

### Out of scope

No changes to prompts, tool schemas, RAG, embeddings, voice (ElevenLabs), or DB. No client-side changes.

