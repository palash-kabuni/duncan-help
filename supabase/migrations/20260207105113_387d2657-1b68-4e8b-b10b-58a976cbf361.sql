-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Company integrations table (for shared/company-wide integrations)
CREATE TABLE public.company_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'disconnected',
    encrypted_api_key text,
    last_sync timestamp with time zone,
    documents_ingested integer DEFAULT 0,
    updated_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on company_integrations
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;

-- Everyone can view company integrations status (but not the key)
CREATE POLICY "Everyone can view company integrations"
ON public.company_integrations
FOR SELECT
USING (true);

-- Only admins can modify company integrations
CREATE POLICY "Admins can manage company integrations"
ON public.company_integrations
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE TRIGGER update_company_integrations_updated_at
BEFORE UPDATE ON public.company_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();