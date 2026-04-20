DROP FUNCTION IF EXISTS public._list_vault_secret_names();

CREATE OR REPLACE FUNCTION public.call_edge_function_with_service_role(
  function_name text,
  body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- Service-role JWT for this project. Only callable by the postgres role (cron).
  service_key constant text := 'eyJhbGciOiJIUzI1NiIsImtpZCI6Ii8vdEVwMzlIajIwR1lvNFQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3Jmd3ZlbXNqd3l0eHhod293cHFoLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJzZXJ2aWNlX3JvbGUiLCJhdWQiOiJzZXJ2aWNlX3JvbGUiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzcwNDU3NjU3LCJleHAiOjIwODYwMzM2NTd9.placeholder';
  request_id bigint;
BEGIN
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

REVOKE ALL ON FUNCTION public.call_edge_function_with_service_role(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_edge_function_with_service_role(text, jsonb) TO postgres;