
Goal

Create a production-grade Claude Code prompt that instructs Claude to design and build a separate local agentic AI layer for Duncan, without changing the current Duncan frontend, Edge Function interfaces, tool flow, streaming contract, or model usage today.

What will be delivered

1. A single Claude Code master prompt the user can paste directly into Claude Code.
2. The prompt will be tailored to Duncan’s current architecture:
   - shared LLM router in `supabase/functions/_shared/llm.ts`
   - `norman-chat` as the main orchestration layer
   - existing SSE/OpenAI-shaped streaming expectations
   - current provider routing where Claude and OpenAI already coexist
   - direct OpenAI embedding dependencies that must remain untouched for now
3. The prompt will explicitly tell Claude Code to build the new layer as a parallel, local service and not to modify Duncan’s live workflows yet.

Planned structure of the Claude Code prompt

1. Objective
- Build a local agentic intelligence/orchestration layer that sits between Duncan and future model providers.
- Preserve current Duncan behavior exactly.
- Keep OpenAI models and current routing active for now.
- Prepare for a future swap from OpenAI-based intelligence paths to Claude-agent-backed reasoning.

2. Current Duncan architecture context
- Duncan frontend remains unchanged.
- Lovable backend / Edge Functions remain the system boundary.
- Current shared LLM router already abstracts provider calls.
- `norman-chat` owns most tool definitions, reasoning loop behavior, and streaming expectations.
- Some workflows still call OpenAI directly for embeddings and file-related operations.
- The new local layer must be designed around this hybrid reality.

3. Non-goals
- No replacement of OpenAI in current production flows.
- No edits to frontend request/response contracts.
- No changes to existing tool schemas, SSE parsing, streaming format, auth flow, or connector logic.
- No migration of embeddings yet.
- No breaking changes to `norman-chat` or `_shared/llm.ts`.

4. Required outputs from Claude Code
- Architecture proposal
- Local service folder structure
- OpenAI-compatible adapter contract
- Agent orchestration design
- Provider abstraction design
- Observability/logging strategy
- Integration plan for future cutover
- Rollback strategy
- Incremental milestone plan

5. Required design constraints for the new local layer
- Must be external/parallel to Duncan’s current workflow
- Must support OpenAI-compatible request/response shapes
- Must support OpenAI-style SSE delta streaming
- Must support tool-call normalization compatible with Duncan
- Must allow future provider swap to Claude agents without frontend changes
- Must preserve Duncan’s existing backend authority over auth, RLS-protected data, and tool execution

6. Future-ready architecture requirement
- Phase 1: local layer acts as a compatibility adapter and orchestration service only
- Phase 2: local layer can add planning, memory, routing, retries, and multi-step agent execution
- Phase 3: Duncan can optionally redirect `_shared/llm.ts` to this service
- Phase 4: selective workflows can migrate one by one
- Phase 5: future Claude-agent replacement can occur behind the same contract

Key technical guidance the prompt will include

- The safest insertion point for future migration is the shared LLM router, not the frontend.
- `norman-chat` should remain the tool execution authority initially.
- The local layer should not assume access to Duncan DB secrets or connectors.
- The local layer should expose stable APIs that mirror current Duncan expectations.
- The design must account for direct embedding calls still using OpenAI.
- The design must separate:
  - provider adapters
  - agent planner/orchestrator
  - tool-call contract normalization
  - streaming formatter
  - observability and trace IDs

Expected Claude Code output requirements

Claude Code will be instructed to produce:
- a concrete architecture document
- service modules and responsibilities
- API contract definitions
- sample OpenAI-compatible endpoints
- sample streaming event format
- integration map back to Duncan
- phased implementation roadmap
- risk list with mitigations
- explicit list of what must remain unchanged in Duncan

Feasibility assessment to encode into the prompt

High feasibility if built as a separate local service first.
Medium feasibility for future gradual cutover.
Low feasibility if attempting “zero backend change forever,” because eventual routing changes will still be needed to adopt the new layer.
Best strategy: build now in isolation, integrate later through the shared router.

Main challenges the prompt will ask Claude Code to handle

- Contract compatibility with existing Duncan SSE behavior
- Tool-call normalization for `norman-chat`
- Preserving streaming semantics
- Avoiding changes to current workflows
- Supporting future Claude-agent swap without redesign
- Handling hybrid provider reality during migration
- Tracing/debugging across Duncan and the local layer
- Latency introduced by an extra hop
- Keeping backend data/tool authority inside Duncan

Implementation phases that the prompt will ask Claude Code to plan

Phase 1
- Analyze Duncan integration boundaries and define compatibility interfaces

Phase 2
- Build local provider abstraction and OpenAI-compatible adapter endpoints

Phase 3
- Add internal agent orchestration primitives:
  - planner
  - executor
  - memory/session abstraction
  - tool intent normalization

Phase 4
- Add observability:
  - request IDs
  - per-step traces
  - stream lifecycle logs
  - latency/error reporting

Phase 5
- Produce future integration instructions for Duncan without applying them now

Technical details

Relevant existing Duncan architecture:
- Shared router: `supabase/functions/_shared/llm.ts`
- Main orchestration engine: `supabase/functions/norman-chat/index.ts`
- Frontend general edge invoke helper: `src/lib/edgeApi.ts`
- Current provider setup:
  - Claude primary for `norman-chat`
  - OpenAI fallback in shared router
  - OpenAI embeddings remain in several direct code paths
- Important compatibility requirement:
  Duncan expects OpenAI-shaped non-streaming responses and OpenAI-shaped SSE delta streams.

Final outcome after approval

I will produce the actual Claude Code prompt in a copy-paste-ready format, written as a strict engineering brief with:
- Duncan-specific architecture context
- hard constraints
- non-goals
- exact deliverables
- phased build instructions
- acceptance criteria
- migration boundaries
