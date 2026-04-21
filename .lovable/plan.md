

## Fix: break the Team Briefing failure loop with a hybrid async pattern

### Why we keep looping

Every "fix" so far has been a parameter tweak on the same broken assumption: that the briefing can complete inside one synchronous edge function request. It cannot. Logs prove it:

```
10:53:01 [llm] ceo-briefing provider=claude attempt=1 status=fallback latency_ms=60002 status=504
10:54:01 [llm] ceo-briefing provider=openai attempt=2 status=fail   latency_ms=60002 status=504
10:54:01 ERROR LLM error: 504 OpenAI timeout after 60000ms
```

Both providers hit the 60s `AbortController` we added last round, the function then returns 502, and the request closes. The previous "Opus is too slow" loop was the same shape — `Http: connection closed` after 173s. We've been moving the timeout knob; the workload genuinely needs ~2-3 minutes of LLM time and Supabase's edge runtime caps idle at 150s.

GPT-5 also turns out to be a reasoning model that ignores `temperature` and renames `max_tokens`. We patched both, but reasoning models are inherently slow on a 60k-char prompt — they don't make the timeout problem better.

### The fix — hybrid async (matches your approval)

Stop trying to make synthesis fit in one HTTP request. Keep the page snappy, run the heavy LLM work in the background, let the UI poll.

**1. New table `ceo_briefing_jobs`**

```text
id uuid pk · user_id uuid · briefing_type text · status text  
  ('queued'|'gathering'|'synthesising'|'completed'|'failed')  
progress int (0-100) · phase text · briefing_id uuid null  
error text null · created_at · updated_at
```

RLS: select/insert own rows; service role full access.

**2. `ceo-briefing` edge function — split into trigger + worker**

- POST `/ceo-briefing` (existing route, same body): authenticate, insert a `ceo_briefing_jobs` row with `status='queued'`, kick off the heavy work via `EdgeRuntime.waitUntil(...)`, return `{ job_id, status: 'queued' }` in <500ms.
- The background task runs the existing pipeline (data gather → priority scan → email pulse → LLM synthesis → guardrails → save), updating `progress`/`phase` after each stage. On success it writes the briefing row and sets `status='completed'`, `briefing_id=<row>`. On failure it stores `error`.
- Bump `PROVIDER_TIMEOUT_MS` back to **150s** for `ceo-briefing` only (Claude Sonnet 4.5 averages 90-180s on this prompt). Background tasks are not bound by the request idle timeout.
- Drop `temperature` from the call so GPT-5 fallback works without the `omit-if-gpt-5` workaround leaking into other workflows.

**3. New `ceo-briefing-status` edge function**

GET with `?job_id=…` → returns `{ status, progress, phase, briefing_id?, error? }`. Cheap, fast, used by the client poller.

**4. `useCEOBriefing` hook — poll the job**

- `generate()` calls `ceo-briefing`, gets `job_id`, sets `generating=true` and `phase='Queued'`.
- Polls `ceo-briefing-status` every 3s.
- Updates a new `progress` + `phase` state for the UI ("Gathering data 25%", "Synthesising 60%", …).
- On `completed`: reload briefings, toast success, clear job state.
- On `failed`: toast `error`, clear job state.
- 5-minute hard cap on the poll loop with a graceful "still running, check back" toast.

**5. `CEOBriefing.tsx` — visible progress while generating**

Replace the spinning "Regenerate" button with a small progress strip when a job is active: phase label + percentage + cancel-poll. The page still shows the previous briefing underneath so the CEO is never blank.

**6. Console-only side fix — `Badge` ref warning**

Convert `src/components/ui/badge.tsx` to `React.forwardRef`. Removes the React warning currently spamming the console from `CEOBriefing.tsx`. Cosmetic, but it's noise we don't need while debugging.

### Out of scope

- No changes to the briefing prompt, schema, post-processors, or scoring guardrails.
- No model changes (Sonnet 4.5 stays primary, GPT-5 stays fallback).
- `ceo-email-pulse`'s ```` ```json ```` wrapping bug (visible in its own logs) is a separate, already-tolerated failure mode — fix in a follow-up.

### Verification

1. Click Generate → response < 1s, page shows "Queued · 0%".
2. Poll updates phase: Gathering → Synthesising → Completed in 2-4 min.
3. Briefing row lands in `ceo_briefings`; UI auto-refreshes.
4. `ceo-briefing` logs show `provider=claude status=ok latency_ms=<150000` from the background task — no more 504/AbortError loop.
5. Refreshing or navigating mid-job is safe — the worker keeps running, the next poll reattaches.

### Technical notes

- `EdgeRuntime.waitUntil` keeps the worker alive past the HTTP response (already used elsewhere per `mem://tech/background-task-execution`).
- The trigger function still validates JWT and writes the job row with the user's id — only Nimesh (CEO-gated route) ever invokes it.
- Status function uses RLS so the poller only sees its own jobs.
- Migration adds the table + indexes on `(user_id, created_at desc)` and `(status)` for the worker.

