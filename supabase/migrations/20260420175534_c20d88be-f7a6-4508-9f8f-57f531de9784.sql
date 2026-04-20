CREATE OR REPLACE FUNCTION public._list_vault_secret_names()
RETURNS TABLE(name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
  SELECT s.name FROM vault.decrypted_secrets s ORDER BY s.name;
$$;
GRANT EXECUTE ON FUNCTION public._list_vault_secret_names() TO postgres, service_role;