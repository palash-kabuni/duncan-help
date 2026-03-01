
-- Add interview transcript and scoring fields to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS interview_transcript text,
  ADD COLUMN IF NOT EXISTS interview_scores jsonb,
  ADD COLUMN IF NOT EXISTS interview_final_score numeric,
  ADD COLUMN IF NOT EXISTS interview_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS hireflix_interview_id text;
