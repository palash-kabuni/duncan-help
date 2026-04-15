import { apiClient } from "@/lib/apiClient";

export const parseCv = (body: { candidate_id: string; base64?: string }) =>
  apiClient.post("/recruitment/parse-cv", body).then((r) => r.data);

export const scoreCompetencies = (body: { candidate_id: string; job_role_id: string }) =>
  apiClient.post("/recruitment/score-competencies", body).then((r) => r.data);

export const scoreValues = (body: { candidate_id: string; job_role_id: string }) =>
  apiClient.post("/recruitment/score-values", body).then((r) => r.data);

export const generateJd = (body: { title: string; description?: string }) =>
  apiClient.post("/recruitment/generate-jd", body).then((r) => r.data);

export const parseJdCompetencies = (body: { job_role_id: string }) =>
  apiClient.post("/recruitment/parse-jd", body).then((r) => r.data);
