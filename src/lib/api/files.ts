import { apiClient } from "@/lib/apiClient";

export const uploadFile = (body: { project_id: string; file_name: string; base64: string }) =>
  apiClient.post("/files/upload", body).then((r) => r.data);

export const deleteFile = (body: { file_id: string }) =>
  apiClient.post("/files/delete", body).then((r) => r.data);

export const extractFileText = (body: { file_name: string; file_type: string; base64: string }) =>
  apiClient.post("/files/extract", body).then((r) => r.data);
