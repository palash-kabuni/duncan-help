CREATE TABLE public.ceo_briefing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  briefing_type text NOT NULL DEFAULT 'morning',
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'Queued',
  briefing_id uuid NULL,
  error text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_briefing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO can view own briefing jobs"
ON public.ceo_briefing_jobs
FOR SELECT
TO authenticated
USING (((auth.jwt() ->> 'email'::text) = 'nimesh@kabuni.com'::text) AND user_id = auth.uid());

CREATE POLICY "CEO can insert own briefing jobs"
ON public.ceo_briefing_jobs
FOR INSERT
TO authenticated
WITH CHECK (((auth.jwt() ->> 'email'::text) = 'nimesh@kabuni.com'::text) AND user_id = auth.uid());

CREATE INDEX idx_ceo_briefing_jobs_user_created ON public.ceo_briefing_jobs (user_id, created_at DESC);
CREATE INDEX idx_ceo_briefing_jobs_status ON public.ceo_briefing_jobs (status);

CREATE TRIGGER update_ceo_briefing_jobs_updated_at
BEFORE UPDATE ON public.ceo_briefing_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();