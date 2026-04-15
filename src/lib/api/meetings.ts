import { apiClient } from "@/lib/apiClient";

export const analyzeMeeting = (body: { meeting_id?: string }) =>
  apiClient.post("/meetings/analyze", body).then((r) => r.data);

export const generateMeetingSummary = (body: { meeting_id: string }) =>
  apiClient.post("/meetings/generate-summary", body).then((r) => r.data);
