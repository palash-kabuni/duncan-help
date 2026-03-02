
-- Allow any authenticated user to create job roles
CREATE POLICY "Authenticated users can create job roles"
ON public.job_roles
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);
