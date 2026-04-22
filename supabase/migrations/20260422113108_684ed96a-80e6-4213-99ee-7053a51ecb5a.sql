CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_members_project_user_uidx
ON public.project_members (project_id, user_id);

CREATE INDEX IF NOT EXISTS project_members_user_idx
ON public.project_members (user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project owners can view collaborator rows" ON public.project_members;
CREATE POLICY "Project owners can view collaborator rows"
ON public.project_members
FOR SELECT
TO authenticated
USING (added_by = auth.uid() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Project owners can add collaborators" ON public.project_members;
CREATE POLICY "Project owners can add collaborators"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  added_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.projects
    WHERE projects.id = project_members.project_id
      AND projects.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project owners can remove collaborators" ON public.project_members;
CREATE POLICY "Project owners can remove collaborators"
ON public.project_members
FOR DELETE
TO authenticated
USING (added_by = auth.uid());

DROP POLICY IF EXISTS "Project collaborators can view shared projects" ON public.projects;
CREATE POLICY "Project collaborators can view shared projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project collaborators can view chats" ON public.project_chats;
CREATE POLICY "Project collaborators can view chats"
ON public.project_chats
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = project_chats.project_id
      AND project_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project collaborators can create chats" ON public.project_chats;
CREATE POLICY "Project collaborators can create chats"
ON public.project_chats
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = project_chats.project_id
      AND project_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project collaborators can update chats" ON public.project_chats;
CREATE POLICY "Project collaborators can update chats"
ON public.project_chats
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = project_chats.project_id
      AND project_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project collaborators can delete chats" ON public.project_chats;
CREATE POLICY "Project collaborators can delete chats"
ON public.project_chats
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_members.project_id = project_chats.project_id
      AND project_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project collaborators can view chat messages" ON public.chat_messages;
CREATE POLICY "Project collaborators can view chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_chats
    JOIN public.project_members ON project_members.project_id = project_chats.project_id
    WHERE project_chats.id = chat_messages.chat_id
      AND project_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project collaborators can create chat messages" ON public.chat_messages;
CREATE POLICY "Project collaborators can create chat messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.project_chats
    JOIN public.project_members ON project_members.project_id = project_chats.project_id
    WHERE project_chats.id = chat_messages.chat_id
      AND project_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Project collaborators can delete chat messages" ON public.chat_messages;
CREATE POLICY "Project collaborators can delete chat messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_chats
    JOIN public.project_members ON project_members.project_id = project_chats.project_id
    WHERE project_chats.id = chat_messages.chat_id
      AND project_members.user_id = auth.uid()
  )
);