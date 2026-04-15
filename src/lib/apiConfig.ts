export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://unsnap-reappoint-defame.ngrok-free.dev";

export const API_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "1",
};

export function apiHeaders(accessToken?: string | null): Record<string, string> {
  return {
    ...API_HEADERS,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}
