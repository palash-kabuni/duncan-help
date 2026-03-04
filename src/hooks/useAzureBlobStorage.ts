import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BlobFile {
  name: string;
  url: string;
  size: number;
  lastModified: string;
}

export interface BlobContent {
  content: string;
  contentType: string;
  name: string;
  url?: string;
}

export interface UploadResult {
  url: string;
  blob_path: string;
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${session.access_token}` };
}

export function useAzureBlobStorage() {
  const [isLoading, setIsLoading] = useState(false);

  const listFiles = useCallback(async (container = "documents", path?: string): Promise<BlobFile[]> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("azure-blob-api", {
        body: { action: "list", container, path },
        headers: await getAuthHeaders(),
      });
      if (error) throw error;
      return data as BlobFile[];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchFiles = useCallback(async (container = "documents", query: string): Promise<BlobFile[]> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("azure-blob-api", {
        body: { action: "search", container, query },
        headers: await getAuthHeaders(),
      });
      if (error) throw error;
      return data as BlobFile[];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadFile = useCallback(async (file: File, container = "documents", path?: string): Promise<UploadResult> => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("container", container);
      if (path) formData.append("path", path);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/azure-blob-api`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${resp.status})`);
      }
      return await resp.json();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFileContent = useCallback(async (container = "documents", blobPath: string): Promise<BlobContent> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("azure-blob-api", {
        body: { action: "get_content", container, blob_path: blobPath },
        headers: await getAuthHeaders(),
      });
      if (error) throw error;
      return data as BlobContent;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, listFiles, searchFiles, uploadFile, getFileContent };
}
