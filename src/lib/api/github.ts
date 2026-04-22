import { invokeEdge } from "@/lib/edgeApi";

export const githubApi = <T = unknown>(body: Record<string, unknown>) =>
  invokeEdge<T>("github-api", { body });