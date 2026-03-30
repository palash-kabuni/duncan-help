ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS requested_role_title text;