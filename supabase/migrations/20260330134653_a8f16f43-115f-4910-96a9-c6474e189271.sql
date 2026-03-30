DROP POLICY IF EXISTS "Authenticated users can enqueue hireflix retries" ON public.hireflix_retry_queue;

CREATE POLICY "Authenticated users can enqueue hireflix retries"
ON public.hireflix_retry_queue
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND operation IN ('create_position', 'delete_position', 'send_invite')
  AND status = 'pending'
  AND attempts = 0
  AND completed_at IS NULL
);