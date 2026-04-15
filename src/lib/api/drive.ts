import { apiClient } from "@/lib/apiClient";

export const getDriveAuth = () =>
  apiClient.get("/drive/auth").then((r) => r.data);

export const driveApi = (body: Record<string, unknown>) =>
  apiClient.post("/drive/api", body).then((r) => r.data);
