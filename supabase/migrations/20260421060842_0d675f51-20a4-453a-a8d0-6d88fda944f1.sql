ALTER TABLE public.gmail_writing_profiles
ADD COLUMN IF NOT EXISTS ceo_briefing_optin boolean NOT NULL DEFAULT false;