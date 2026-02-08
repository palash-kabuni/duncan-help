import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useGoogleDrive() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("google_drive_tokens")
        .select("id")
        .limit(1)
        .maybeSingle();
      
      setIsConnected(!!data && !error);
      return !!data && !error;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, []);

  const initiateOAuth = useCallback(async () => {
    if (!user) {
      throw new Error("You must be logged in to connect Google Drive");
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to start OAuth flow");
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No OAuth URL returned");
      }
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  }, [user]);

  const disconnect = useCallback(async () => {
    if (!user) {
      throw new Error("You must be logged in to disconnect");
    }

    setIsLoading(true);
    try {
      // Only admins can disconnect (enforced by RLS)
      const { error } = await supabase
        .from("google_drive_tokens")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) {
        throw new Error(error.message || "Failed to disconnect Google Drive");
      }

      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isConnected,
    isLoading,
    checkConnection,
    initiateOAuth,
    disconnect,
  };
}
