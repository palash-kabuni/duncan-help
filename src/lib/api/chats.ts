import { apiClient } from "@/lib/apiClient";

export const createChat = (body: { project_id?: string; title?: string }) =>
  apiClient.post("/chats", body).then((r) => r.data);

export const getChats = (params?: { project_id?: string }) =>
  apiClient.get(`/chats${params?.project_id ? `?project_id=${params.project_id}` : ""}`).then((r) => r.data);

export const sendMessage = (body: { chat_id: string; content: string; role?: string }) =>
  apiClient.post("/chats/message", body).then((r) => r.data);
