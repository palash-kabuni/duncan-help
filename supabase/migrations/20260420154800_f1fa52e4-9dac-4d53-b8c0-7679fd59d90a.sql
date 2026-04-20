
CREATE TABLE public.workstream_task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.workstream_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_workstream_task_comments_task_id ON public.workstream_task_comments(task_id);

ALTER TABLE public.workstream_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task comments"
  ON public.workstream_task_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can add task comments"
  ON public.workstream_task_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own task comments"
  ON public.workstream_task_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage task comments"
  ON public.workstream_task_comments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
