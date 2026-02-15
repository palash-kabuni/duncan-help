
-- NDA submissions table for idempotency tracking and status logging
CREATE TABLE public.nda_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id uuid NOT NULL,
  submitter_email text,
  receiving_party_name text NOT NULL,
  receiving_party_entity text NOT NULL,
  date_of_agreement date NOT NULL,
  registered_address text NOT NULL,
  purpose text NOT NULL,
  recipient_name text NOT NULL,
  recipient_email text NOT NULL,
  google_doc_id text,
  google_doc_url text,
  notion_page_id text,
  notion_page_url text,
  docusign_envelope_id text,
  status text NOT NULL DEFAULT 'draft',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nda_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "Users can view own NDA submissions"
ON public.nda_submissions FOR SELECT
USING (auth.uid() = submitter_id);

-- Admins can view all submissions
CREATE POLICY "Admins can view all NDA submissions"
ON public.nda_submissions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Users can insert their own submissions
CREATE POLICY "Users can insert own NDA submissions"
ON public.nda_submissions FOR INSERT
WITH CHECK (auth.uid() = submitter_id);

-- Admins can update any submission (for status changes)
CREATE POLICY "Admins can update NDA submissions"
ON public.nda_submissions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Users can update their own submissions
CREATE POLICY "Users can update own NDA submissions"
ON public.nda_submissions FOR UPDATE
USING (auth.uid() = submitter_id);

-- Trigger for updated_at
CREATE TRIGGER update_nda_submissions_updated_at
BEFORE UPDATE ON public.nda_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookups
CREATE INDEX idx_nda_submissions_submitter ON public.nda_submissions(submitter_id);
CREATE INDEX idx_nda_submissions_status ON public.nda_submissions(status);
CREATE INDEX idx_nda_submissions_envelope ON public.nda_submissions(docusign_envelope_id) WHERE docusign_envelope_id IS NOT NULL;
