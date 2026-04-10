
-- Create releases table
CREATE TABLE public.releases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamp with time zone,
  published_by uuid,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT releases_version_unique UNIQUE (version)
);

-- Enable RLS
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage releases"
  ON public.releases FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can view published releases
CREATE POLICY "Authenticated users can view published releases"
  ON public.releases FOR SELECT
  TO authenticated
  USING (status = 'published');

-- Updated at trigger
CREATE TRIGGER update_releases_updated_at
  BEFORE UPDATE ON public.releases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create release email logs table
CREATE TABLE public.release_email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.release_email_logs ENABLE ROW LEVEL SECURITY;

-- Admins can manage email logs
CREATE POLICY "Admins can manage release email logs"
  ON public.release_email_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own email logs
CREATE POLICY "Users can view own release email logs"
  ON public.release_email_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
