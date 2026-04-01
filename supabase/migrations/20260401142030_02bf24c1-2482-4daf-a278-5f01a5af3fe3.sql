
-- Create projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  system_prompt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create project_chats table
CREATE TABLE public.project_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project chats" ON public.project_chats
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_chats.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can create chats in own projects" ON public.project_chats
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_chats.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update own project chats" ON public.project_chats
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_chats.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete own project chats" ON public.project_chats
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_chats.project_id AND projects.user_id = auth.uid()));

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.project_chats(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_chats
    JOIN public.projects ON projects.id = project_chats.project_id
    WHERE project_chats.id = chat_messages.chat_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create messages in own chats" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_chats
    JOIN public.projects ON projects.id = project_chats.project_id
    WHERE project_chats.id = chat_messages.chat_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own chat messages" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_chats
    JOIN public.projects ON projects.id = project_chats.project_id
    WHERE project_chats.id = chat_messages.chat_id AND projects.user_id = auth.uid()
  ));

-- Create project_files table
CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project files" ON public.project_files
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can upload files to own projects" ON public.project_files
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete own project files" ON public.project_files
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));
