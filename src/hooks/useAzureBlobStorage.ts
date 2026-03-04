import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AzureBlob {
  name: string;
  url: string;
  size?: number;
  lastModified?: string;
}

export interface AzureBlobContent {
  name: string;
  blob_path: string;
  content_type: string;
  content: string;
  size?: number;
}

export interface AzureUploadResult {
  url: string;
  blob_path: string;
}

export function useAzureBlobStorage() {
  const [isLoading, setIsLoading] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("You must be logged in");
    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const listFiles = useCallback(
    async (container: string, path?: string): Promise<AzureBlob[]> => {
      setIsLoading(true);
      try {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke(
          "azure-blob-api",
          {
            headers,
            body: { action: "list", container, path },
          }
        );
        if (error) throw new Error(error.message || "Failed to list files");
        return data as AzureBlob[];
      } finally {
        setIsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const searchFiles = useCallback(
    async (container: string, query: string): Promise<AzureBlob[]> => {
      setIsLoading(true);
      try {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke(
          "azure-blob-api",
          {
            headers,
            body: { action: "search", container, query },
          }
        );
        if (error) throw new Error(error.message || "Search failed");
        return data as AzureBlob[];
      } finally {
        setIsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  const uploadFile = useCallback(
    async (
      file: File,
      container: string,
      path: string
    ): Promise<AzureUploadResult> => {
      setIsLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("You must be logged in");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("container", container);
        formData.append("path", path);

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

        return (await resp.json()) as AzureUploadResult;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getFileContent = useCallback(
    async (
      container: string,
      blob_path: string
    ): Promise<AzureBlobContent> => {
      setIsLoading(true);
      try {
        const headers = await getAuthHeaders();
        const { data, error } = await supabase.functions.invoke(
          "azure-blob-api",
          {
            headers,
            body: { action: "get_content", container, blob_path },
          }
        );
        if (error)
          throw new Error(error.message || "Failed to get file content");
        return data as AzureBlobContent;
      } finally {
        setIsLoading(false);
      }
    },
    [getAuthHeaders]
  );

  return { isLoading, listFiles, searchFiles, uploadFile, getFileContent };
}
