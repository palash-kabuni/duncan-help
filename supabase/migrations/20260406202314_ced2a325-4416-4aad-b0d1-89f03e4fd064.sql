
-- General chat sessions (like ChatGPT conversations)
CREATE TABLE public.general_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages within general chats
CREATE TABLE public.general_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.general_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.general_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own chats
CREATE POLICY "Users can view own chats" ON public.general_chats FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create own chats" ON public.general_chats FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own chats" ON public.general_chats FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own chats" ON public.general_chats FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Messages: users can access messages from their own chats
CREATE POLICY "Users can view own chat messages" ON public.general_chat_messages FOR SELECT TO authenticated USING (chat_id IN (SELECT id FROM public.general_chats WHERE user_id = auth.uid()));
CREATE POLICY "Users can create own chat messages" ON public.general_chat_messages FOR INSERT TO authenticated WITH CHECK (chat_id IN (SELECT id FROM public.general_chats WHERE user_id = auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_general_chats_user_id ON public.general_chats(user_id);
CREATE INDEX idx_general_chat_messages_chat_id ON public.general_chat_messages(chat_id);
