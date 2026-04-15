import { supabase } from "@/integrations/supabase/client";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://unsnap-reappoint-defame.ngrok-free.dev";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "1",
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
  };
}

/**
 * Calls a Supabase edge function AND a FastAPI endpoint in parallel.
 * Returns the Supabase result so the UI is never affected.
 * Logs FastAPI result to console for comparison.
 */
export async function shadowInvoke<T>(
  supabaseFn: string,
  supabaseBody: Record<string, unknown>,
  fastapiMethod: "GET" | "POST" | "PUT" | "DELETE",
  fastapiPath: string,
  fastapiBody?: Record<string, unknown>,
): Promise<T> {
  const supabasePromise = supabase.functions.invoke<T>(supabaseFn, {
    body: supabaseBody,
  });

  getAuthHeaders().then((headers) =>
    fetch(`${API_BASE}${fastapiPath}`, {
      method: fastapiMethod,
      headers,
      body: fastapiBody ? JSON.stringify(fastapiBody) : undefined,
    })
      .then((r) => r.json())
      .then((data) => console.log(`[Shadow ✓] ${fastapiMethod} ${fastapiPath}`, data))
      .catch((err) => console.warn(`[Shadow ✗] ${fastapiMethod} ${fastapiPath}`, err))
  );

  const { data, error } = await supabasePromise;
  if (error) throw error;
  return data as T;
}
