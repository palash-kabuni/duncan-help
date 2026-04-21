
-- ceo_briefings: open SELECT to all authenticated, restrict INSERT to Nimesh
DROP POLICY IF EXISTS "CEO can view briefings" ON public.ceo_briefings;
DROP POLICY IF EXISTS "CEO can insert briefings" ON public.ceo_briefings;

CREATE POLICY "Authenticated can view briefings"
ON public.ceo_briefings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO can insert briefings"
ON public.ceo_briefings
FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

-- ceo_briefing_jobs: open SELECT to all authenticated, restrict INSERT to Nimesh
DROP POLICY IF EXISTS "CEO can view own briefing jobs" ON public.ceo_briefing_jobs;
DROP POLICY IF EXISTS "CEO can insert own briefing jobs" ON public.ceo_briefing_jobs;

CREATE POLICY "Authenticated can view briefing jobs"
ON public.ceo_briefing_jobs
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CEO can insert own briefing jobs"
ON public.ceo_briefing_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email') = 'nimesh@kabuni.com'
  AND user_id = auth.uid()
);
