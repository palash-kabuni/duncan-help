import { apiClient } from "@/lib/apiClient";

export const getBasecampAuth = () =>
  apiClient.get("/basecamp/auth").then((r) => r.data);

export const basecampApi = (body: Record<string, unknown>) =>
  apiClient.post("/basecamp/api", body).then((r) => r.data);
