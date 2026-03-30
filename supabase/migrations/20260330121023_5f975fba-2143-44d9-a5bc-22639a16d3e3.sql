CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, department, role_title, approval_status, requested_role_title)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    NEW.raw_user_meta_data ->> 'department',
    NEW.raw_user_meta_data ->> 'role_title',
    'pending',
    NEW.raw_user_meta_data ->> 'role_title'
  );
  RETURN NEW;
END;
$function$