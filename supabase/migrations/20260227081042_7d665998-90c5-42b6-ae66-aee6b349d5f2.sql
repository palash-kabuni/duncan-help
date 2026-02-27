-- Add JD storage path to job_roles
ALTER TABLE public.job_roles ADD COLUMN jd_storage_path text;

-- Create storage bucket for job descriptions
INSERT INTO storage.buckets (id, name, public) VALUES ('job-descriptions', 'job-descriptions', false);

-- RLS: admins can manage JD files
CREATE POLICY "Admins can upload JDs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job-descriptions' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view JDs"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-descriptions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete JDs"
ON storage.objects FOR DELETE
USING (bucket_id = 'job-descriptions' AND public.has_role(auth.uid(), 'admin'));