import { apiClient } from "@/lib/apiClient";

export const createProject = (body: { name: string; system_prompt?: string }) =>
  apiClient.post("/projects", body).then((r) => r.data);

export const getProjects = () =>
  apiClient.get("/projects").then((r) => r.data);
