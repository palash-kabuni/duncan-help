
-- Create issues table
CREATE TABLE public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  title text NOT NULL,
  issue_type text NOT NULL DEFAULT 'Other',
  description text NOT NULL DEFAULT '',
  steps_to_reproduce text DEFAULT '',
  expected_behavior text DEFAULT '',
  actual_behavior text DEFAULT '',
  affected_area text DEFAULT '',
  severity text NOT NULL DEFAULT 'Medium',
  frequency text NOT NULL DEFAULT 'Sometimes',
  retrieval_relevant text DEFAULT 'Not Applicable',
  confidence_score integer DEFAULT 3,
  attachment_paths text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- Users can insert their own issues
CREATE POLICY "Users can insert own issues" ON public.issues
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own issues
CREATE POLICY "Users can view own issues" ON public.issues
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all issues
CREATE POLICY "Admins can view all issues" ON public.issues
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all issues
CREATE POLICY "Admins can manage all issues" ON public.issues
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for issue attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('issue-attachments', 'issue-attachments', false);

-- Storage policies for issue attachments
CREATE POLICY "Users can upload issue attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'issue-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own issue attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'issue-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can view all issue attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'issue-attachments' AND public.has_role(auth.uid(), 'admin'));
