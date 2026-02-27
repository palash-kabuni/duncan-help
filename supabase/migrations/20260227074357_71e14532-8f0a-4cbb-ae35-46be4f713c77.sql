-- Drop the unique constraint on gmail_message_id to allow multiple candidates per email
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_gmail_message_id_key;