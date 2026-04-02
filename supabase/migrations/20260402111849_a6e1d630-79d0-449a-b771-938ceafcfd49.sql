DROP POLICY IF EXISTS "Users can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete project files" ON storage.objects;

CREATE POLICY "Users can upload project files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view project files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete project files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
      AND p.user_id = auth.uid()
  )
);