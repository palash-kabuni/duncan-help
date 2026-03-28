
-- Retry queue for failed Hireflix operations
CREATE TABLE public.hireflix_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL, -- 'create_position', 'delete_position'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  created_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.hireflix_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage retry queue" ON public.hireflix_retry_queue
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view retry queue" ON public.hireflix_retry_queue
  FOR SELECT TO public USING (auth.uid() IS NOT NULL);
