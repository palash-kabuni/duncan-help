
ALTER TABLE public.nda_submissions
  ADD COLUMN internal_signer_name TEXT DEFAULT 'Palash Soundarkar',
  ADD COLUMN internal_signer_email TEXT DEFAULT 'palash@kabuni.com';
