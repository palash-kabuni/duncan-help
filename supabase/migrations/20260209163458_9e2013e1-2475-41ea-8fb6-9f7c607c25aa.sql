
-- Table to store pre-configured Google Forms
CREATE TABLE public.google_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  form_url TEXT NOT NULL,
  form_action_url TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- fields JSONB structure: [{ "entry_id": "entry.123456", "label": "Full Name", "type": "text", "required": true, "options": ["Option A", "Option B"] }]

ALTER TABLE public.google_forms ENABLE ROW LEVEL SECURITY;

-- Admins can manage, all authenticated users can read
CREATE POLICY "Authenticated users can view forms"
  ON public.google_forms FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert forms"
  ON public.google_forms FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update forms"
  ON public.google_forms FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete forms"
  ON public.google_forms FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_google_forms_updated_at
  BEFORE UPDATE ON public.google_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
