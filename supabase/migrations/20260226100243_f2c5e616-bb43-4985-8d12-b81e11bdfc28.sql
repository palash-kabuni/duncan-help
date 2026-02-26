
-- Gmail tokens table
CREATE TABLE public.gmail_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_by UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  email_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gmail tokens"
  ON public.gmail_tokens FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view gmail connection status"
  ON public.gmail_tokens FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Job roles table
CREATE TABLE public.job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  competencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  company_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage job roles"
  ON public.job_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view job roles"
  ON public.job_roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role_id UUID REFERENCES public.job_roles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  cv_text TEXT,
  cv_storage_path TEXT,
  gmail_message_id TEXT UNIQUE,
  email_subject TEXT,
  competency_score NUMERIC,
  values_score NUMERIC,
  total_score NUMERIC,
  scoring_details JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage candidates"
  ON public.candidates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view candidates"
  ON public.candidates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Storage bucket for CVs
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false);

CREATE POLICY "Admins can manage CVs"
  ON storage.objects FOR ALL
  USING (bucket_id = 'cvs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view CVs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cvs' AND auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_gmail_tokens_updated_at
  BEFORE UPDATE ON public.gmail_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_roles_updated_at
  BEFORE UPDATE ON public.job_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
