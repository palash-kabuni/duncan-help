import { supabase } from "@/integrations/supabase/client";

type EdgeInvokeOptions = {
  body?: unknown;
};

export async function invokeEdge<T = unknown>(functionName: string, options: EdgeInvokeOptions = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: options.body,
  });

  if (error) {
    throw new Error(error.message || `Request to ${functionName} failed`);
  }

  const payload = data as Record<string, unknown> | null;
  if (payload && typeof payload.error === "string") {
    throw new Error(payload.error);
  }

  return data as T;
}

export async function getEdgeAuthUrl(functionName: string): Promise<string> {
  const data = await invokeEdge<{ url?: string }>(functionName);
  if (!data?.url) {
    throw new Error(`No auth URL returned from ${functionName}`);
  }
  return data.url;
}