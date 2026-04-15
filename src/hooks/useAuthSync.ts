import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Listens to every Supabase auth state change and forwards the
 * session token (or a sign-out signal) to the FastAPI backend.
 * Mount once at app root level.
 */
export function useAuthSync() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          await fetch(`${API_BASE}/api/auth/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {}),
            },
            body: JSON.stringify({
              event,                           // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
              access_token: session?.access_token ?? null,
              refresh_token: session?.refresh_token ?? null,
              user_id: session?.user?.id ?? null,
              email: session?.user?.email ?? null,
              expires_at: session?.expires_at ?? null,
            }),
          });
          console.log(`[AuthSync] ${event} → forwarded to FastAPI`);
        } catch (err) {
          console.warn(`[AuthSync] ${event} → failed to reach FastAPI`, err);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);
}
