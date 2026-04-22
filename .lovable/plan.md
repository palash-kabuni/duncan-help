
## Quick sanity check: current state

### What looks healthy
- **General chat persistence** is alive: `general_chats` has fresh rows updated today.
- **Daily briefing endpoint** is responding: `daily-briefing` returned `200` and correctly reported `already_shown_today`.
- **Team Briefing background jobs** are completing: latest `ceo_briefing_jobs` rows are `completed`, `progress=100`.
- **Prompt engine backend exists and is active**: `supabase/functions/norman-chat/index.ts` is the main Duncan runtime, and recent logs show `[llm] workflow=norman-chat ... status=ok stream=open`.

### What looks broken or risky right now
1. **Dead external API fallback is still wired into the app**
   - `src/lib/apiConfig.ts`
   - `src/lib/apiClient.ts`
   - `src/lib/fastApiClient.ts`
   - `src/hooks/useAuthSync.ts`
   - multiple `src/lib/api/*.ts` wrappers

   These still default to:
   ```ts
   https://unsnap-reappoint-defame.ngrok-free.dev
   ```
   That is almost certainly stale. The browser console already shows:
   - `[AuthSync] SIGNED_IN → failed to reach FastAPI`
   - `TypeError: Failed to fetch`

   So even if Duncan chat itself uses edge functions, a large set of other features/endpoints can silently fail or degrade because they still hit the dead ngrok URL.

2. **Prompt engine path is split across two architectures**
   - Main homepage chat uses `src/hooks/useNormanChat.ts` → direct edge function call to `/functions/v1/norman-chat`
   - Many other features still use `apiClient` / `fastApiClient` wrappers → dead external base URL unless explicitly configured

   Result: “Duncan isn’t working” can be true for some surfaces while others still work.

3. **Prompt engine response path needs deeper live validation**
   - `norman-chat` direct test did not return a clean response in the read-only check; it ended with a canceled request while daily-briefing worked.
   - That points to a likely **streaming / long-running / client-consumption issue** rather than the endpoint being totally absent.

4. **Team Briefing UI has React warnings**
   - Console shows:
     - `Function components cannot be given refs`
     - pointing at `CEOBriefing`, `Section`, and `LovableContributorsCard`
   - Not the root cause of Duncan failure, but it is a real frontend issue on `/team-briefing`.

---

## Likely root causes behind “Duncan not responding as well”

### Root cause A — stale external backend dependency
The biggest concrete issue is the old FastAPI/ngrok base URL still embedded as the fallback/default transport for many app features. That affects:
- auth sync
- integrations auth/disconnect flows
- file/document helpers
- recruitment API wrappers
- chat-adjacent API wrappers
- any page using `fastApi(...)`, `withFastApi(...)`, or `apiClient`

### Root cause B — mixed transport architecture
The app is half on:
- **edge functions**
and half on:
- **external HTTP backend wrappers**

That means reliability depends on which path each feature happens to use.

### Root cause C — streaming prompt-engine behavior not fully hardened
`useNormanChat.ts` expects clean SSE token streaming from `norman-chat`. The backend is complex:
- builds tools
- streams model output
- parses tool calls
- executes tools
- continues reasoning

That path is functional in code, but needs a focused end-to-end validation pass because it is the most likely place for intermittent “not responding” reports.

---

## What to implement next

### 1. Stabilize transport layer
Replace or neutralize the stale ngrok dependency so the app no longer relies on a dead external backend by default.

Files to update:
- `src/lib/apiConfig.ts`
- `src/lib/apiClient.ts`
- `src/lib/fastApiClient.ts`
- `src/hooks/useAuthSync.ts`
- `src/lib/duncanApi.ts`
- `src/lib/api/*.ts`
- any page/hook using `fastApi(...)` or `withFastApi(...)`

Goal:
- edge-function-backed features should call Lovable Cloud directly
- external backend calls should only happen if explicitly configured and healthy
- silent failures should no longer be treated as normal

### 2. Do a full endpoint sanity matrix
Validate each live endpoint path the app depends on, grouped by feature:

#### Core Duncan
- `norman-chat`
- `extract-chat-file`
- `daily-briefing`

#### Team Briefing
- `ceo-briefing`
- `ceo-briefing-status`
- `ceo-email-pulse`
- `ceo-slack-pulse`

#### Google
- `gmail-api`
- `gmail-auth`
- `google-calendar-api`
- `google-calendar-auth`
- `google-drive-api`
- `google-drive-auth`

#### Ops / project systems
- `azure-devops-api`
- `azure-devops-auth`
- `basecamp-api`
- `basecamp-auth`
- `xero-api`
- `xero-auth`

#### Project workspace
- `create-project`
- `create-project-chat`
- `get-project-chats`
- `upload-project-file`
- `extract-file-text`
- `chat-with-project-context`

For each one:
- auth behavior
- expected response shape
- current failure mode
- frontend caller location

### 3. Harden prompt engine E2E
Focus on the full Duncan message flow:

```text
Index.tsx
→ useNormanChat.ts
→ /functions/v1/norman-chat
→ streamLLM()
→ tool-call loop
→ streamed SSE back to client
→ UI render + persistence
```

Implementation goals:
- detect empty/aborted streams explicitly
- surface real toast/error states instead of silently appending a generic warning into chat
- verify tool-call continuation works after first LLM response
- confirm auth token handling is consistent
- ensure chat save timing does not race with stream completion

### 4. Remove hidden failure paths in frontend wrappers
Right now several wrappers can fail in ways users experience as “nothing happened”.
Add consistent behavior across:
- loading states
- timeout handling
- non-2xx surfacing
- auth-expired handling
- user-visible error messages

Primary targets:
- `src/hooks/useNormanChat.ts`
- `src/lib/apiClient.ts`
- `src/lib/fastApiClient.ts`
- integration hooks/pages

### 5. Fix Team Briefing page warnings
Address the ref warning in:
- `src/pages/CEOBriefing.tsx`
- `src/components/ceo/LovableContributorsCard.tsx`

Goal:
- remove invalid ref usage
- keep `/team-briefing` clean while debugging broader Duncan issues

### 6. Add minimum observability for future incidents
Add clearer runtime logging around:
- chat request start/end
- stream opened / first token / completed / aborted
- tool call count
- tool execution failures
- endpoint-specific failures in frontend transport

This is necessary so future “Duncan is not working” reports can be tied to:
- dead transport
- auth failure
- token refresh issue
- tool call failure
- model timeout
- frontend SSE parse issue

---

## Priority order

### P0
1. Remove stale ngrok dependency from active client flows
2. Validate `norman-chat` end-to-end
3. Validate all currently used feature endpoints

### P1
4. Standardize frontend error handling for endpoint failures
5. Fix Team Briefing console/ref issues

### P2
6. Improve observability for prompt-engine quality/debugging

---

## Expected outcome
After this pass, Duncan should have:
- one reliable transport path
- predictable endpoint behavior
- clearer failures instead of silent degradation
- a verified prompt-engine streaming path
- fewer false reports caused by old backend wiring

