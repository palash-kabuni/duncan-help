import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CALENDAR_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-api`;
const CALENDAR_AUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth`;

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  attendees?: { email: string; responseStatus?: string }[];
  htmlLink?: string;
}

export interface Calendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

export function useGoogleCalendar() {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const getAuthHeaders = useCallback(() => {
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }, [session]);

  const initiateOAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(CALENDAR_AUTH_URL, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate OAuth");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("OAuth initiation error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  const checkConnection = useCallback(async () => {
    if (!session) {
      setIsConnected(false);
      return false;
    }

    try {
      const response = await fetch(CALENDAR_API_URL, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: "checkConnection" }),
      });

      const data = await response.json();
      
      if (data.code === "NOT_CONNECTED") {
        setIsConnected(false);
        return false;
      }

      if (!response.ok) {
        setIsConnected(false);
        return false;
      }

      setIsConnected(true);
      return true;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, [session, getAuthHeaders]);

  const listCalendars = useCallback(async (): Promise<Calendar[]> => {
    setIsLoading(true);
    try {
      const response = await fetch(CALENDAR_API_URL, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: "listCalendars" }),
      });

      if (!response.ok) {
        throw new Error("Failed to list calendars");
      }

      const data = await response.json();
      return data.items || [];
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  const listEvents = useCallback(
    async (params?: {
      calendarId?: string;
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
    }): Promise<CalendarEvent[]> => {
      setIsLoading(true);
      try {
        const response = await fetch(CALENDAR_API_URL, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ action: "listEvents", params }),
        });

        if (!response.ok) {
          throw new Error("Failed to list events");
        }

        const data = await response.json();
        return data.items || [];
      } finally {
        setIsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const createEvent = useCallback(
    async (event: {
      summary: string;
      description?: string;
      start: { dateTime: string; timeZone?: string };
      end: { dateTime: string; timeZone?: string };
      location?: string;
      attendees?: { email: string }[];
    }, calendarId = "primary"): Promise<CalendarEvent> => {
      setIsLoading(true);
      try {
        const response = await fetch(CALENDAR_API_URL, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action: "createEvent",
            params: { calendarId, event },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create event");
        }

        return await response.json();
      } finally {
        setIsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const updateEvent = useCallback(
    async (
      eventId: string,
      event: Partial<{
        summary: string;
        description?: string;
        start: { dateTime: string; timeZone?: string };
        end: { dateTime: string; timeZone?: string };
        location?: string;
      }>,
      calendarId = "primary"
    ): Promise<CalendarEvent> => {
      setIsLoading(true);
      try {
        const response = await fetch(CALENDAR_API_URL, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action: "updateEvent",
            params: { calendarId, eventId, event },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update event");
        }

        return await response.json();
      } finally {
        setIsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const deleteEvent = useCallback(
    async (eventId: string, calendarId = "primary"): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetch(CALENDAR_API_URL, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action: "deleteEvent",
            params: { calendarId, eventId },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to delete event");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const disconnect = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", session.user.id);

      if (error) throw error;
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  return {
    isLoading,
    isConnected,
    initiateOAuth,
    checkConnection,
    listCalendars,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    disconnect,
  };
}
