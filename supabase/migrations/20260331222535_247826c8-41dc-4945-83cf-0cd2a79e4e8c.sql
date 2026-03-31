
-- User notification mappings: links Basecamp person → Duncan user → Slack destination
CREATE TABLE public.user_notification_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duncan_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  basecamp_person_id integer NOT NULL,
  basecamp_name text NOT NULL,
  slack_user_identifier text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(duncan_user_id),
  UNIQUE(basecamp_person_id)
);

ALTER TABLE public.user_notification_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification mappings"
  ON public.user_notification_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view mappings"
  ON public.user_notification_mappings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Slack notification logs: stores digest payloads (placeholder until Slack connected)
CREATE TABLE public.slack_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  slack_user_identifier text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slack_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification logs"
  ON public.slack_notification_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view notification logs"
  ON public.slack_notification_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Unmapped users log: tracks Basecamp users without a Duncan mapping
CREATE TABLE public.unmapped_users_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basecamp_person_id integer NOT NULL,
  basecamp_name text NOT NULL,
  context text,
  logged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unmapped_users_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage unmapped users log"
  ON public.unmapped_users_log FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view unmapped users log"
  ON public.unmapped_users_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Updated_at trigger for mappings
CREATE TRIGGER update_user_notification_mappings_updated_at
  BEFORE UPDATE ON public.user_notification_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
