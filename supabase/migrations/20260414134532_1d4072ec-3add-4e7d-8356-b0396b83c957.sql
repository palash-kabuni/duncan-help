
-- Add columns to workstream_card_assignees
ALTER TABLE public.workstream_card_assignees
  ADD COLUMN assignment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN responded_at timestamptz,
  ADD COLUMN decline_reason text;

-- Allow assignees to update their own assignment records
CREATE POLICY "Assignees can update own assignment status"
  ON public.workstream_card_assignees
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
