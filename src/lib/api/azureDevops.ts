import { apiClient } from "@/lib/apiClient";

export const getAzureDevopsAuth = () =>
  apiClient.get("/azure-devops/auth").then((r) => r.data);

export const azureDevopsApi = (body: Record<string, unknown>) =>
  apiClient.post("/azure-devops/api", body).then((r) => r.data);
