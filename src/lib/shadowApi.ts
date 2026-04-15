import { supabase } from "@/integrations/supabase/client";

const FASTAPI = import.meta.env.VITE_API_BASE_URL ?? "https://unsnap-reappoint-defame.ngrok-free.dev";

export async function shadow(method: string, path: string, body?: unknown) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(FASTAPI + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => r.json()).then(d => console.log(`[FastAPI ✓] ${method} ${path}`, d));
  } catch (e) {
    console.warn(`[FastAPI ✗] ${method} ${path}`, e);
  }
}
