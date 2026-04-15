import { apiClient } from "@/lib/apiClient";

export const generateNda = (body: Record<string, unknown>) =>
  apiClient.post("/nda/generate", body).then((r) => r.data);

export const searchNda = (body: { query: string }) =>
  apiClient.post("/nda/search", body).then((r) => r.data);

export const sendNdaSignature = (body: { submission_id: string }) =>
  apiClient.post("/nda/send-signature", body).then((r) => r.data);
