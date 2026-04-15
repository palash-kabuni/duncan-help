import { supabase } from "@/integrations/supabase/client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://unsnap-reappoint-defame.ngrok-free.dev";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Duncan API ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Personalised daily briefing */
export const getBriefing = () => request<unknown>("POST", "/api/briefing");

/** Trigger meeting fetch from connected sources */
export const fetchMeetings = () => request<unknown>("POST", "/api/meetings/fetch");

/** Analyse a specific meeting (or all pending) */
export const analyzeMeetings = (meetingId?: string) =>
  request<unknown>("POST", "/api/meetings/analyze", meetingId ? { meeting_id: meetingId } : {});

/** Generate an NDA document */
export const generateNDA = (data: object) =>
  request<unknown>("POST", "/api/nda/generate", data);

/** List connected integrations */
export const getIntegrations = () => request<unknown>("GET", "/api/integrations");
