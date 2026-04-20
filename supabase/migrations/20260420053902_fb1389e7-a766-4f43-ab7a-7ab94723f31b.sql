CREATE TABLE public.gmail_writing_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  style_summary TEXT NOT NULL DEFAULT '',
  common_phrases JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_replies JSONB NOT NULL DEFAULT '[]'::jsonb,
  tone_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_trained_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_writing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own writing profile"
ON public.gmail_writing_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own writing profile"
ON public.gmail_writing_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own writing profile"
ON public.gmail_writing_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own writing profile"
ON public.gmail_writing_profiles FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_gmail_writing_profiles_updated_at
BEFORE UPDATE ON public.gmail_writing_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();