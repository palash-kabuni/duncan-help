
-- Junction table for card assignees (multiple people per card)
CREATE TABLE public.workstream_card_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.workstream_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(card_id, user_id)
);

-- Junction table for task assignees (multiple people per task)
CREATE TABLE public.workstream_task_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.workstream_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.workstream_card_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstream_task_assignees ENABLE ROW LEVEL SECURITY;

-- RLS policies for card assignees
CREATE POLICY "Authenticated users can view card assignees" ON public.workstream_card_assignees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage card assignees" ON public.workstream_card_assignees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete card assignees" ON public.workstream_card_assignees FOR DELETE TO authenticated USING (true);

-- RLS policies for task assignees
CREATE POLICY "Authenticated users can view task assignees" ON public.workstream_task_assignees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage task assignees" ON public.workstream_task_assignees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete task assignees" ON public.workstream_task_assignees FOR DELETE TO authenticated USING (true);
