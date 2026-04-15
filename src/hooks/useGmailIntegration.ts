import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { shadow } from "@/lib/shadowApi";
import { toast } from "sonner";

export interface GmailEmail {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  labelIds: string[];
  isUnread: boolean;
}

export interface GmailFullEmail extends GmailEmail {
  to: string;
  cc?: string;
  bcc?: string;
  htmlBody?: string;
  textBody?: string;
}

export interface GmailStatus {
  connected: boolean;
  email?: string;
  lastSync?: string;
  expired?: boolean;
}

async function gmailApi(action: string, body: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("gmail-api", {
    body: { action, ...body },
  });
  shadow("POST", "/gmail/api", { action, ...body });
  if (error) throw new Error(error.message || "Gmail API error");
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useGmailStatus() {
  return useQuery<GmailStatus>({
    queryKey: ["gmail-status"],
    queryFn: () => gmailApi("status"),
    staleTime: 30_000,
  });
}

export function useGmailConnect() {
  const [loading, setLoading] = useState(false);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-auth");
      shadow("GET", "/gmail/auth");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No auth URL returned");
    } catch (err: any) {
      toast.error(err.message || "Failed to start Gmail OAuth");
      setLoading(false);
    }
  }, []);

  return { connect, loading };
}

export function useGmailDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gmailApi("disconnect"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmail-status"] });
      qc.invalidateQueries({ queryKey: ["gmail-emails"] });
      toast.success("Gmail disconnected");
    },
  });
}

export function useGmailEmails(pageToken?: string) {
  return useQuery({
    queryKey: ["gmail-emails", "list", pageToken],
    queryFn: () => gmailApi("list", { pageToken, maxResults: 25 }),
    staleTime: 60_000,
  });
}

export function useGmailSearch() {
  const [results, setResults] = useState<{ emails: GmailEmail[]; nextPageToken?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string, pageToken?: string) => {
    setLoading(true);
    try {
      const data = await gmailApi("search", { query, pageToken, maxResults: 25 });
      setResults(data);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setResults(null), []);

  return { results, loading, search, clear };
}

export function useGmailReadEmail() {
  return useMutation({
    mutationFn: (messageId: string) => gmailApi("read", { messageId }),
  });
}

export function useGmailSendEmail() {
  return useMutation({
    mutationFn: (params: { to: string; cc?: string; bcc?: string; subject: string; body: string }) =>
      gmailApi("send", params),
    onSuccess: () => toast.success("Email sent successfully!"),
    onError: (err: any) => toast.error(err.message || "Failed to send email"),
  });
}
