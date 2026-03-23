CREATE OR REPLACE FUNCTION public.set_po_approval_tier()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.total_amount < 300 THEN
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
$function$;