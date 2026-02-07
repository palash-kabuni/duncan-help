
-- Add personal context columns to profiles for Norman personalization
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS norman_context TEXT;
