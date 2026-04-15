import { apiClient } from "@/lib/apiClient";

export const getXeroAuth = () =>
  apiClient.get("/xero/auth").then((r) => r.data);

export const xeroApi = (body: Record<string, unknown>) =>
  apiClient.post("/xero/api", body).then((r) => r.data);
