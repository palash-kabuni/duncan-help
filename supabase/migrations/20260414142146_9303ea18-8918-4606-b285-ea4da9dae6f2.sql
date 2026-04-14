CREATE POLICY "Anyone can view departments"
  ON public.departments
  FOR SELECT
  TO anon
  USING (true);