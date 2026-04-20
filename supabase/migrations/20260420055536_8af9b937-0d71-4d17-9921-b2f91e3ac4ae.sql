ALTER TABLE public.gmail_writing_profiles
  ADD COLUMN IF NOT EXISTS auto_draft_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_draft_last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_drafts_created_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_drafts_counter_date date NOT NULL DEFAULT CURRENT_DATE;