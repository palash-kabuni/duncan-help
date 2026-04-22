import { invokeEdge } from "@/lib/edgeApi";

export const hubspotApi = <T = unknown>(body: Record<string, unknown>) =>
  invokeEdge<T>("hubspot-api", { body });