import { apiClient } from "@/lib/apiClient";

export const getGmailAuth = () =>
  apiClient.get("/gmail/auth").then((r) => r.data);

export const gmailApi = (body: Record<string, unknown>) =>
  apiClient.post("/gmail/api", body).then((r) => r.data);
