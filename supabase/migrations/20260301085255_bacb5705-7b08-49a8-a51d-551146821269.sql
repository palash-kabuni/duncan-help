
-- Add Hireflix tracking columns to candidates
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS hireflix_status text DEFAULT null,
ADD COLUMN IF NOT EXISTS hireflix_interview_url text DEFAULT null,
ADD COLUMN IF NOT EXISTS hireflix_invited_at timestamp with time zone DEFAULT null;
