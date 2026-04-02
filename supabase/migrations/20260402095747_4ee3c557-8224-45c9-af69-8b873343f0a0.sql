DROP POLICY IF EXISTS "Users can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete project files" ON storage.objects;

CREATE POLICY "Users can upload project files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view project files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete project files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.user_id = auth.uid()
  )
);