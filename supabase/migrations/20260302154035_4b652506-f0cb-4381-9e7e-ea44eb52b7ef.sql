-- Allow authenticated users to upload to job-descriptions bucket
CREATE POLICY "Authenticated users can upload job descriptions"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'job-descriptions' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to read job descriptions
CREATE POLICY "Authenticated users can read job descriptions"
ON storage.objects
FOR SELECT
USING (bucket_id = 'job-descriptions' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update job descriptions
CREATE POLICY "Authenticated users can update job descriptions"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'job-descriptions' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete job descriptions
CREATE POLICY "Authenticated users can delete job descriptions"
ON storage.objects
FOR DELETE
USING (bucket_id = 'job-descriptions' AND auth.uid() IS NOT NULL);