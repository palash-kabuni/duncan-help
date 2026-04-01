
-- Create project-files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- RLS: Users can upload to their own projects
CREATE POLICY "Users can upload project files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- RLS: Users can view their own project files
CREATE POLICY "Users can view project files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

-- RLS: Users can delete their own project files
CREATE POLICY "Users can delete project files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);
