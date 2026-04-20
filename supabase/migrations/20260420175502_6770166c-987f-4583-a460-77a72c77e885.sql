-- Helper that reads the service-role key from Vault and calls an edge function.
-- Runs as SECURITY DEFINER so cron (running as the postgres user) can use it.
CREATE OR REPLACE FUNCTION public.call_edge_function_with_service_role(
  function_name text,
  body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  service_key text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE EXCEPTION 'SUPABASE_SERVICE_ROLE_KEY not found in vault';
  END IF;

  SELECT net.http_post(
    url := 'https://rfwvemsjwytxxhwowpqh.supabase.co/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := body
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.call_edge_function_with_service_role(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.call_edge_function_with_service_role(text, jsonb) TO postgres;