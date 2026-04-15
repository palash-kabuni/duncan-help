import { apiClient } from "@/lib/apiClient";

export const sendHireflixInvite = (body: { candidate_id: string; position_id: string }) =>
  apiClient.post("/hireflix/send-invite", body).then((r) => r.data);

export const syncHireflixInterviews = (body?: Record<string, unknown>) =>
  apiClient.post("/hireflix/sync-interviews", body).then((r) => r.data);

export const createHireflixPosition = (body: { job_role_id: string }) =>
  apiClient.post("/hireflix/create-position", body).then((r) => r.data);
