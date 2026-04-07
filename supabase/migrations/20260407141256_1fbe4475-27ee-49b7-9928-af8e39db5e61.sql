
-- Workstream cards
CREATE TABLE public.workstream_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'amber',
  priority text NOT NULL DEFAULT 'medium',
  owner_id uuid,
  due_date date,
  project_tag text,
  created_by uuid NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Workstream tasks (checklist items inside cards)
CREATE TABLE public.workstream_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.workstream_cards(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  assignee_id uuid,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comments on cards
CREATE TABLE public.workstream_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.workstream_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activity log for cards
CREATE TABLE public.workstream_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.workstream_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.workstream_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstream_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstream_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstream_activity ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can view all workstream data (team collaboration tool)
CREATE POLICY "Authenticated users can view cards" ON public.workstream_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create cards" ON public.workstream_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update cards" ON public.workstream_cards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete cards" ON public.workstream_cards FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

CREATE POLICY "Authenticated users can view tasks" ON public.workstream_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create tasks" ON public.workstream_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON public.workstream_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tasks" ON public.workstream_tasks FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view comments" ON public.workstream_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.workstream_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.workstream_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view activity" ON public.workstream_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create activity" ON public.workstream_activity FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_workstream_cards_status ON public.workstream_cards(status);
CREATE INDEX idx_workstream_cards_owner ON public.workstream_cards(owner_id);
CREATE INDEX idx_workstream_cards_created_by ON public.workstream_cards(created_by);
CREATE INDEX idx_workstream_tasks_card_id ON public.workstream_tasks(card_id);
CREATE INDEX idx_workstream_comments_card_id ON public.workstream_comments(card_id);
CREATE INDEX idx_workstream_activity_card_id ON public.workstream_activity(card_id);
