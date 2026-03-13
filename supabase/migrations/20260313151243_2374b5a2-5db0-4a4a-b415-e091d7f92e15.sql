
-- Azure DevOps tokens (company-level)
CREATE TABLE public.azure_devops_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry timestamptz NOT NULL,
  org_url text,
  connected_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.azure_devops_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage azure devops tokens" ON public.azure_devops_tokens FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view azure devops connection" ON public.azure_devops_tokens FOR SELECT USING (auth.uid() IS NOT NULL);

-- Xero tokens (company-level)
CREATE TABLE public.xero_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry timestamptz NOT NULL,
  tenant_id text,
  connected_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xero_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage xero tokens" ON public.xero_tokens FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view xero connection" ON public.xero_tokens FOR SELECT USING (auth.uid() IS NOT NULL);

-- Synced Azure work items
CREATE TABLE public.azure_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id integer NOT NULL,
  title text NOT NULL,
  state text,
  work_item_type text,
  assigned_to text,
  area_path text,
  iteration_path text,
  priority integer,
  tags text,
  description text,
  created_date timestamptz,
  changed_date timestamptz,
  project_name text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_id, project_name)
);
ALTER TABLE public.azure_work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view work items" ON public.azure_work_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service can manage work items" ON public.azure_work_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Synced Xero invoices
CREATE TABLE public.xero_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  invoice_number text,
  contact_name text,
  contact_id text,
  type text,
  status text,
  date date,
  due_date date,
  amount_due numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  total numeric DEFAULT 0,
  currency_code text DEFAULT 'GBP',
  line_items jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xero_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view invoices" ON public.xero_invoices FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage invoices" ON public.xero_invoices FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Synced Xero contacts
CREATE TABLE public.xero_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  phone text,
  is_supplier boolean DEFAULT false,
  is_customer boolean DEFAULT false,
  contact_status text,
  outstanding_balance numeric DEFAULT 0,
  overdue_balance numeric DEFAULT 0,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xero_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contacts" ON public.xero_contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage contacts" ON public.xero_contacts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Sync logs
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text NOT NULL,
  sync_type text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  records_synced integer DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sync logs" ON public.sync_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage sync logs" ON public.sync_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Integration audit logs
CREATE TABLE public.integration_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON public.integration_audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage audit logs" ON public.integration_audit_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
