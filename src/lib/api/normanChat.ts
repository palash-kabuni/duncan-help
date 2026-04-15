import { apiClient } from "@/lib/apiClient";

/**
 * SSE streaming chat endpoint.
 * Returns a raw Response so the caller can consume the ReadableStream.
 */
export const streamChat = (body: {
  messages: Array<{ role: string; content: unknown }>;
  mode?: string;
  userProfile?: Record<string, unknown>;
}) => apiClient.stream("/norman-chat", body);
