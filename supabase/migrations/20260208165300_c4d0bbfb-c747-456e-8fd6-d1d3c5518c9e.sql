-- Create table for Google Drive tokens (company-wide integration)
CREATE TABLE public.google_drive_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only one company-wide connection allowed
CREATE UNIQUE INDEX google_drive_tokens_singleton ON public.google_drive_tokens ((true));

-- Enable RLS
ALTER TABLE public.google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can manage the connection
CREATE POLICY "Admins can manage drive tokens"
ON public.google_drive_tokens
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read (to check connection status)
CREATE POLICY "Authenticated users can view drive connection status"
ON public.google_drive_tokens
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_google_drive_tokens_updated_at
BEFORE UPDATE ON public.google_drive_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();