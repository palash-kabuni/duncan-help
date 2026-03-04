import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BlobItem {
  name: string;
  url: string;
  size: number;
  lastModified: string;
}

interface BlobContent {
  content: string;
  contentType: string;
  name: string;
}

interface UploadResult {
  url: string;
  blob_path: string;
}

export function useAzureBlobStorage() {
  const [isLoading, setIsLoading] = useState(false);

  const callAzureApi = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase.functions.invoke("azure-blob-api", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body,
    });

    if (error) throw new Error(error.message || "Azure API error");
    return data;
  }, []);

  const listFiles = useCallback(
    async (container: string, path?: string): Promise<BlobItem[]> => {
      setIsLoading(true);
      try {
        return await callAzureApi({ action: "list", container, path });
      } finally {
        setIsLoading(false);
      }
    },
    [callAzureApi],
  );

  const searchFiles = useCallback(
    async (container: string, query: string): Promise<BlobItem[]> => {
      setIsLoading(true);
      try {
        return await callAzureApi({ action: "search", container, query });
      } finally {
        setIsLoading(false);
      }
    },
    [callAzureApi],
  );

  const uploadFile = useCallback(
    async (file: File, container: string, path?: string): Promise<UploadResult> => {
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
    },
    [],
  );

  const getFileContent = useCallback(
    async (container: string, blobPath: string): Promise<BlobContent> => {
      setIsLoading(true);
      try {
        return await callAzureApi({ action: "get_content", container, blob_path: blobPath });
      } finally {
        setIsLoading(false);
      }
    },
    [callAzureApi],
  );

  return { listFiles, searchFiles, uploadFile, getFileContent, isLoading };
}
