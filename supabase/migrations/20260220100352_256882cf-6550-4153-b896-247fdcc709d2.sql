
-- Table to store Basecamp OAuth tokens (company-level, admin-only)
CREATE TABLE public.basecamp_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_by UUID NOT NULL,
  account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.basecamp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage basecamp tokens"
  ON public.basecamp_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view basecamp connection status"
  ON public.basecamp_tokens FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_basecamp_tokens_updated_at
  BEFORE UPDATE ON public.basecamp_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
