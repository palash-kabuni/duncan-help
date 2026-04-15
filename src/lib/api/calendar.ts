import { apiClient } from "@/lib/apiClient";

export const getCalendarAuth = () =>
  apiClient.get("/calendar/auth").then((r) => r.data);

export const calendarApi = (body: Record<string, unknown>) =>
  apiClient.post("/calendar/api", body).then((r) => r.data);
