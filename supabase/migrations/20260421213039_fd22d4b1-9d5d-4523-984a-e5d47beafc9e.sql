
CREATE TABLE public.lovable_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  member_name text NOT NULL,
  role text,
  period_credits integer NOT NULL DEFAULT 0,
  period_label text,
  total_credits integer NOT NULL DEFAULT 0,
  credit_limit integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lovable_usage_snapshots_date ON public.lovable_usage_snapshots(snapshot_date DESC);

ALTER TABLE public.lovable_usage_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lovable snapshots"
ON public.lovable_usage_snapshots
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert lovable snapshots"
ON public.lovable_usage_snapshots
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete lovable snapshots"
ON public.lovable_usage_snapshots
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
