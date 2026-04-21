

## Fix: Team Briefing edge function timeout (Opus too slow)

### Root cause

Logs show: `[llm] workflow=ceo-briefing provider=claude attempt=1 status=ok latency_ms=173328` followed by `Http: connection closed before message completed`. Claude Opus 4.5 took **2 minutes 53 seconds** to synthesise the briefing — the HTTP connection to the client closed before the function could deliver the response, even though the LLM call itself succeeded. The next "fix" attempt then triggered a second 5xx because the function was already shutting down.

Opus is too slow for any synchronous request-response workflow. This will keep happening on `norman-chat` (chat hot path) and any other heavy synthesis call we routed to Opus.

### Fix — 3 changes, no client-side work

**1. Demote Opus from primary on latency-sensitive synchronous workflows**

Edit `supabase/functions/_shared/llm.ts` `WORKFLOW_ROUTING` so Opus is only used where we can tolerate 2-3 minute responses (none, currently). Sonnet 4.5 stays the default Claude model — still excellent reasoning, ~3-5× faster.

| Workflow | Before | After |
|---|---|---|
| `norman-chat` | Opus | **Sonnet** (chat must feel instant) |
| `ceo-briefing` | Opus | **Sonnet** (sync request) |
| `ceo-email-pulse` | Opus | **Sonnet** |
| `analyze-meeting` | Opus | **Sonnet** |
| `chat-with-project-context` | Opus | **Sonnet** |
| `gmail-auto-draft` | Opus | **Sonnet** |
| `gmail-train-style` | Opus | **Sonnet** |
| `generate-jd`, `parse-jd-competencies` | Opus | **Sonnet** |
| `score-cv-values`, `score-cv-competencies` | Opus | **Sonnet** |
| `finalize-release`, `generate-exec-summary` | Opus | **Sonnet** (still synchronous) |

Net effect: Opus is wired in but unused. Promote individual workflows back to Opus only if/when we move them to a background job pattern (see #3).

Implementation: change the `MODELS.claude.primary` constant from `claude-opus-4-5` to `claude-sonnet-4-5-20250929`, and `MODELS.claude.degrade` from Sonnet to `claude-haiku-4-5`. This is a one-line model swap — `WORKFLOW_ROUTING` keys stay `"claude"` so cross-provider fallback to GPT-5 still works.

**2. Tighten timeouts + add abort handling in the LLM router**

In `_shared/llm.ts`:
- Add a 90-second `AbortController` per provider attempt. If Claude doesn't respond in 90s, abort and trigger fallback to GPT-5 (instead of waiting 173s for the edge runtime to kill the connection).
- Catch `AbortError` in `callLLMWithFallback` as a retryable error (same code path as 429/5xx).
- Log `[llm] workflow=… status=timeout latency_ms=90000` so timeouts are visible.

**3. Document the long-running workflow rule**

Update `mem://tech/llm-provider`: any workflow that needs Opus must use the background-task pattern (`EdgeRuntime.waitUntil` + DB row for status + client polling) — never a synchronous HTTP response. Today, no workflow does this, so Opus is effectively reserved for future use.

### Verification

- Redeploy `_shared/llm.ts` consumers: `ceo-briefing`, `ceo-email-pulse`, `norman-chat`, `analyze-meeting`, `chat-with-project-context`, `gmail-auto-draft`, `gmail-train-style`, `generate-jd`, `parse-jd-competencies`, `score-cv-values`, `score-cv-competencies`, `finalize-release`, `generate-exec-summary`, `parse-cv`, `extract-chat-file`, `extract-file-text`, `hireflix-sync-interviews`, `hireflix-retry-processor`, `create-hireflix-position`.
- Trigger Team Briefing from `/team-briefing` → expect `provider=claude model=claude-sonnet-4-5-20250929 status=ok latency_ms<60000` and a successful response.
- Send a Duncan chat message → confirm streaming still works on Sonnet.
- Tail `ceo-briefing` logs to confirm no `Http: connection closed` errors.

### Out of scope

- No DB changes, no client changes, no prompt changes.
- Background-job refactor for Opus-grade synthesis is a separate piece of work — flagged in memory but not built here.
- GPT-5 / OpenAI side untouched.

