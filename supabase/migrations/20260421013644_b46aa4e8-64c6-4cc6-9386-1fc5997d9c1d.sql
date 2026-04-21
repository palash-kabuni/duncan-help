CREATE TABLE public.ceo_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  briefing_type text NOT NULL CHECK (briefing_type IN ('morning','evening')),
  trajectory text,
  outcome_probability numeric,
  execution_score integer,
  workstream_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (briefing_date, briefing_type)
);

ALTER TABLE public.ceo_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO can view briefings"
  ON public.ceo_briefings FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

CREATE POLICY "CEO can insert briefings"
  ON public.ceo_briefings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'nimesh@kabuni.com');

CREATE INDEX idx_ceo_briefings_date ON public.ceo_briefings (briefing_date DESC, briefing_type);