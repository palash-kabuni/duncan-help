

## Why you see "Retrying compact briefing" → "Retrying ultra-compact briefing"

The briefing prompt now carries a lot of grounded data — workstream cards, Azure items, meetings, Slack signals, email signals, 4-pass friction reasoning, plus the JSON schema for every section. The model (currently `claude-haiku-4-5` / `gpt-5-mini`) is being asked to return a fully structured JSON briefing inside a **4096-token output cap**.

When the JSON it generates exceeds 4096 tokens, the provider returns a `MODEL_TRUNCATED` error. The function then:

1. **Retry 1 — "Retrying compact briefing"**: same prompt + a `compactPromptSuffix` telling the model to be terser, with `max_tokens: 3072`.
2. **Retry 2 — "Retrying ultra-compact briefing"**: adds an `ultraCompactPromptSuffix`, drops to `max_tokens: 2048`.
3. **Final fallback**: deterministic skeleton with the "had to ship a reduced briefing" brutal-truth line.

So those messages aren't a bug — they're the system catching a too-long AI response and trying smaller variants. But it's happening every run now, which means the cap is wrong for the amount of evidence we're feeding it.

## What we'll fix

### 1. Raise the first-pass token budget
`max_tokens: 4096` is too tight for the current payload (Slack + email + 4-pass friction + workstreams + decisions + automation + brutal truth, all as structured JSON with citations). Raise to **8192** on the first attempt. Both Claude Haiku 4.5 and GPT-5-mini support this comfortably. Keep 4096 → 2048 as the retry ladder so we still degrade gracefully if the model genuinely runs away.

### 2. Trim what we send the model, not just what we ask back
Right now we pass full lists into the prompt. Cap the heavy arrays before they hit the LLM:
- **Workstream cards**: top 40 by recency/priority (already partially done — verify).
- **Azure work items**: top 30 active + any past-due (drop closed >7d).
- **Slack signals**: keep structured signals only, drop raw message text (it's already extracted).
- **Email signals**: same — structured only.
- **Meetings**: last 7d, summary fields only.

This shortens both input and the JSON the model has to echo back in citations.

### 3. Better signalling in the UI
The phase strings "Retrying compact briefing" / "Retrying ultra-compact briefing" leak internal mechanics. Replace with one neutral line: **"Optimising briefing length…"** so it doesn't look like an error to the CEO. Keep the detailed phases in the edge function logs for debugging.

### 4. Log when truncation happens
Add a `payload.generation_meta` field capturing `attempts: 1|2|3|fallback` and `final_max_tokens`. So we can tell from the briefing row whether it ran clean or had to retry — useful to know if the prompt keeps growing.

## Files touched
- `supabase/functions/ceo-briefing/index.ts`
  - Raise first-attempt `max_tokens` 4096 → 8192.
  - Cap input arrays (cards/azure/slack/email/meetings) before prompt assembly.
  - Replace retry phase strings with "Optimising briefing length…".
  - Write `generation_meta` into payload.
- Re-deploy `ceo-briefing`.

## Out of scope
- Switching the model away from Haiku/mini (the smaller models are deliberate for cost/speed).
- Restructuring the JSON schema — current shape is correct, it's just verbose.
- Touching `ceo-slack-pulse` or `ceo-email-pulse` — they're already returning compact structured JSON.

