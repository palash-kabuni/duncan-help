/**
 * @deprecated Use `withFastApi(supabaseCall, fastApiCall)` from "@/lib/fastApiClient" instead.
 *
 * This module is preserved as a thin no-op alias so that any straggler imports
 * continue to compile. The original fire-and-forget shadow call has been
 * replaced everywhere by the `withFastApi` pattern, which gives us a single
 * code path for both "Supabase primary + FastAPI parallel" and "FastAPI
 * primary with Supabase fallback" (controlled by `VITE_USE_FASTAPI`).
 */
import { fastApi } from "@/lib/fastApiClient";

export async function shadow(
  method: "GET" | "POST" | "PUT" | "DELETE" | string,
  path: string,
  body?: unknown,
) {
  try {
    const m = (method.toUpperCase() as "GET" | "POST" | "PUT" | "DELETE");
    await fastApi(m, path, body);
  } catch (e) {
    console.warn(`[shadow ✗] ${method} ${path}`, e);
  }
}
