
-- Routing table: owner_key -> email
CREATE TABLE public.ceo_action_routing (
  owner_key TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_action_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO can view routing"
  ON public.ceo_action_routing FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

CREATE POLICY "CEO can insert routing"
  ON public.ceo_action_routing FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

CREATE POLICY "CEO can update routing"
  ON public.ceo_action_routing FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

CREATE POLICY "CEO can delete routing"
  ON public.ceo_action_routing FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

CREATE TRIGGER ceo_action_routing_updated_at
  BEFORE UPDATE ON public.ceo_action_routing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 7 leadership owners (emails pre-filled; CEO can edit in UI)
INSERT INTO public.ceo_action_routing (owner_key, email, display_name) VALUES
  ('alex_cmo',       'alex@kabuni.com',     'Alex (CMO)'),
  ('simon_ops',      'simon@kabuni.com',    'Simon (Ops Director)'),
  ('matt_cpo',       'matt@kabuni.com',     'Matt (CPO)'),
  ('patrick_cfo',    'patrick@kabuni.com',  'Patrick (CFO)'),
  ('palash_duncan',  'palash@kabuni.com',   'Palash (Head of Duncan)'),
  ('ellaine_ops',    'ellaine@kabuni.com',  'Ellaine (Ops)'),
  ('parmy_cto',      'parmy@kabuni.com',    'Parmy (CTO)');

-- Email send audit log
CREATE TABLE public.ceo_briefing_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL REFERENCES public.ceo_briefings(id) ON DELETE CASCADE,
  owner_key TEXT,
  recipient_email TEXT NOT NULL,
  action_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  sent_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_briefing_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO can view email logs"
  ON public.ceo_briefing_email_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

CREATE POLICY "CEO can insert email logs"
  ON public.ceo_briefing_email_logs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

CREATE INDEX idx_ceo_briefing_email_logs_briefing ON public.ceo_briefing_email_logs(briefing_id);
