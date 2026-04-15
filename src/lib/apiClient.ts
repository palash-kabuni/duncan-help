import { supabase } from "@/integrations/supabase/client";
import { API_BASE_URL, apiHeaders } from "@/lib/apiConfig";

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

class ApiClient {
  private base: string;

  constructor(base: string) {
    this.base = base.replace(/\/+$/, "");
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await getToken();
    return apiHeaders(token);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: await this.headers(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as T;
    return { data, status: res.status };
  }

  async get<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body);
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, body);
  }

  async del<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path);
  }

  /** For SSE streaming endpoints — returns the raw Response for ReadableStream consumption */
  async stream(path: string, body?: unknown): Promise<Response> {
    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: await this.headers(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API stream ${path} failed (${res.status}): ${text}`);
    }
    return res;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
