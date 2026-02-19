
-- Create PO category enum
CREATE TYPE public.po_category AS ENUM ('software', 'hardware', 'services', 'marketing', 'travel', 'office_supplies', 'other');

-- Create PO status enum
CREATE TYPE public.po_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled');

-- Departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departments"
  ON public.departments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage departments"
  ON public.departments FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Budgets table (annual budget per department per category)
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  category po_category NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, category, fiscal_year)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view budgets"
  ON public.budgets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage budgets"
  ON public.budgets FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Purchase Orders table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  vendor_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category po_category NOT NULL DEFAULT 'other',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  delivery_date DATE,
  status po_status NOT NULL DEFAULT 'draft',
  approval_tier TEXT, -- 'auto', 'department_owner', 'admin'
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  attachment_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own POs
CREATE POLICY "Users can view own POs"
  ON public.purchase_orders FOR SELECT
  USING (auth.uid() = requester_id);

-- Department owners can view POs in their department
CREATE POLICY "Dept owners can view dept POs"
  ON public.purchase_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.departments
      WHERE id = department_id AND owner_user_id = auth.uid()
    )
  );

-- Admins can view all POs
CREATE POLICY "Admins can view all POs"
  ON public.purchase_orders FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Users can create POs
CREATE POLICY "Users can create POs"
  ON public.purchase_orders FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Department owners can update POs in their department (approve/reject)
CREATE POLICY "Dept owners can update dept POs"
  ON public.purchase_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.departments
      WHERE id = department_id AND owner_user_id = auth.uid()
    )
  );

-- Admins can update all POs
CREATE POLICY "Admins can update all POs"
  ON public.purchase_orders FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Users can update their own draft POs
CREATE POLICY "Users can update own draft POs"
  ON public.purchase_orders FOR UPDATE
  USING (auth.uid() = requester_id AND status = 'draft');

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate PO numbers
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.purchase_orders;
  NEW.po_number := 'PO-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_po_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL OR NEW.po_number = '')
  EXECUTE FUNCTION public.generate_po_number();

-- Function to determine approval tier and auto-approve if under £500
CREATE OR REPLACE FUNCTION public.set_po_approval_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.total_amount < 500 THEN
    NEW.approval_tier := 'auto';
    NEW.status := 'approved';
    NEW.approved_at := now();
  ELSIF NEW.total_amount <= 5000 THEN
    NEW.approval_tier := 'department_owner';
    NEW.status := 'pending_approval';
  ELSE
    NEW.approval_tier := 'admin';
    NEW.status := 'pending_approval';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_approval_tier
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_po_approval_tier();

-- Function to update budget spent_amount when PO is approved
CREATE OR REPLACE FUNCTION public.update_budget_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.budgets
    SET spent_amount = spent_amount + NEW.total_amount
    WHERE department_id = NEW.department_id
      AND category = NEW.category
      AND fiscal_year = EXTRACT(YEAR FROM now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_budget_spent
  AFTER INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_budget_on_approval();

-- Storage bucket for PO attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('po-attachments', 'po-attachments', false);

CREATE POLICY "Users can upload PO attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'po-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view PO attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'po-attachments' AND auth.uid() IS NOT NULL);
