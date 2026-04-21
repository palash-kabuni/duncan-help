-- Extend CEO Briefing access to Palash (palash@kabuni.com) for debugging.
-- Replaces single-email checks with an allowlist on every ceo_* table policy.

-- ceo_briefings
DROP POLICY IF EXISTS "CEO can view briefings" ON public.ceo_briefings;
DROP POLICY IF EXISTS "CEO can insert briefings" ON public.ceo_briefings;
CREATE POLICY "CEO can view briefings" ON public.ceo_briefings
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com']));
CREATE POLICY "CEO can insert briefings" ON public.ceo_briefings
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com']));

-- ceo_action_routing
DROP POLICY IF EXISTS "CEO can view routing" ON public.ceo_action_routing;
DROP POLICY IF EXISTS "CEO can insert routing" ON public.ceo_action_routing;
DROP POLICY IF EXISTS "CEO can update routing" ON public.ceo_action_routing;
DROP POLICY IF EXISTS "CEO can delete routing" ON public.ceo_action_routing;
CREATE POLICY "CEO can view routing" ON public.ceo_action_routing
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com']));
CREATE POLICY "CEO can insert routing" ON public.ceo_action_routing
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com']));
CREATE POLICY "CEO can update routing" ON public.ceo_action_routing
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com']));
CREATE POLICY "CEO can delete routing" ON public.ceo_action_routing
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com']));

-- ceo_briefing_email_logs
DROP POLICY IF EXISTS "CEO can view email logs" ON public.ceo_briefing_email_logs;
DROP POLICY IF EXISTS "CEO can insert email logs" ON public.ceo_briefing_email_logs;
CREATE POLICY "CEO can view email logs" ON public.ceo_briefing_email_logs
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com']));
CREATE POLICY "CEO can insert email logs" ON public.ceo_briefing_email_logs
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com']));

-- ceo_briefing_jobs
DROP POLICY IF EXISTS "CEO can view own briefing jobs" ON public.ceo_briefing_jobs;
DROP POLICY IF EXISTS "CEO can insert own briefing jobs" ON public.ceo_briefing_jobs;
CREATE POLICY "CEO can view own briefing jobs" ON public.ceo_briefing_jobs
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com'])
    AND user_id = auth.uid()
  );
CREATE POLICY "CEO can insert own briefing jobs" ON public.ceo_briefing_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') = ANY (ARRAY['nimesh@kabuni.com','palash@kabuni.com'])
    AND user_id = auth.uid()
  );