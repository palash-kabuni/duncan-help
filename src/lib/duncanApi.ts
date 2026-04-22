import { invokeEdge } from "@/lib/edgeApi";

async function request<T>(functionName: string, body?: unknown): Promise<T> {
  return invokeEdge<T>(functionName, body !== undefined ? { body } : undefined);
}

/** Personalised daily briefing */
export const getBriefing = () => request<unknown>("daily-briefing");

/** Trigger meeting fetch from connected sources */
export const fetchMeetings = () => request<unknown>("fetch-plaud-meetings");

/** Analyse a specific meeting (or all pending) */
export const analyzeMeetings = (meetingId?: string) =>
  request<unknown>("analyze-meeting", meetingId ? { meeting_id: meetingId } : {});

/** Generate an NDA document */
export const generateNDA = (data: object) =>
  request<unknown>("nda-generate", data);

/** List connected integrations */
export const getIntegrations = () => request<unknown>("manage-company-integration", { action: "status" });
