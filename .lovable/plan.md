
## Fix prompt duplication when starting a new dashboard chat

### What is happening
The duplication is coming from the dashboard chat flow in `src/pages/Index.tsx`:

- `handleChatSubmit()` lazily creates a DB chat on first send
- it immediately saves the user message to `general_chat_messages`
- it then sets `activeChatId`
- that triggers the `useEffect` that reloads messages from the database
- at the same time, `useNormanChat.send()` is also optimistically appending the same user prompt to local UI state

This creates a race between:
- the optimistic in-memory message
- the freshly reloaded persisted message

Result: the first prompt can appear twice when initiating a new chat from the dashboard.

### Implementation plan

1. Update the new-chat send flow in `src/pages/Index.tsx`
   - Keep lazy chat creation as-is
   - Prevent the `activeChatId` hydration effect from reloading messages in the middle of the first in-flight send for a newly created chat

2. Add a small guard for first-message initialization
   - Track when the dashboard is creating the first message for a brand-new chat
   - While that initialization is in progress, skip or defer the `loadMessages()` effect that runs on `activeChatId` change
   - Once the first send is complete, allow normal persisted loading behavior again

3. Preserve the existing persistence behavior
   - Continue saving the user message to `general_chat_messages`
   - Continue saving the assistant reply after streaming completes
   - Do not change backend tables, chat schema, or general chat persistence logic

4. Keep the fix scoped to dashboard chat only
   - Limit changes to `src/pages/Index.tsx`
   - Do not modify `useGeneralChats`
   - Do not modify backend functions or database logic unless absolutely required for type safety

### Why this is the safest fix
This avoids changing core chat storage behavior and fixes the actual race condition at the UI orchestration layer, where the duplication is introduced. It keeps:
- optimistic UX
- lazy chat creation
- persisted chat history
- assistant save behavior

### Expected result after implementation
When a user starts a brand-new dashboard chat:
- the first prompt appears once
- the assistant streams normally
- the chat is persisted correctly
- reopening the thread later still shows the full conversation from storage

### Validation
After implementation, verify:

1. Start a brand-new chat from the dashboard
   - first user prompt appears only once

2. Wait for assistant response
   - assistant appears once and completes normally

3. Refresh or reopen the same chat
   - history still shows one user prompt and one assistant response

4. Start another brand-new chat
   - duplication does not recur

5. Open an existing chat from history
   - existing hydration behavior still works normally
