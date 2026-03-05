
-- Create meetings table for Plaud AI meeting transcripts and analysis
CREATE TABLE public.meetings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    meeting_date timestamp with time zone,
    transcript text,
    audio_storage_path text,
    gmail_message_id text,
    email_subject text,
    sender_email text,
    source text NOT NULL DEFAULT 'plaud',
    analysis jsonb,
    summary text,
    action_items jsonb,
    participants text[],
    status text NOT NULL DEFAULT 'pending',
    fetched_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view meetings"
ON public.meetings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage meetings"
ON public.meetings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert meetings"
ON public.meetings FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Create storage bucket for meeting audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-audio', 'meeting-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for meeting-audio bucket
CREATE POLICY "Authenticated users can read meeting audio"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-audio');

CREATE POLICY "Authenticated users can upload meeting audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'meeting-audio');
