import { apiClient } from "@/lib/apiClient";

export const getDailyBriefing = () =>
  apiClient.get("/misc/daily-briefing").then((r) => r.data);

export const getElevenLabsToken = () =>
  apiClient.get("/misc/elevenlabs-token").then((r) => r.data);

export const checkOverdueTasks = () =>
  apiClient.post("/misc/check-overdue-tasks").then((r) => r.data);
