import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyIntegration {
  id: string;
  integration_id: string;
  status: string;
  last_sync: string | null;
  documents_ingested: number | null;
  created_at: string;
  updated_at: string;
}

export function useCompanyIntegrations() {
  return useQuery({
    queryKey: ["company-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_integrations")
        .select("id, integration_id, status, last_sync, documents_ingested, created_at, updated_at");
      if (error) throw error;
      return (data ?? []) as CompanyIntegration[];
    },
  });
}

export function useUpdateCompanyIntegration() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      integrationId,
      apiKey,
      action,
    }: {
      integrationId: string;
      apiKey?: string;
      action?: "disconnect";
    }) => {
      const res = await supabase.functions.invoke("manage-company-integration", {
        body: { integration_id: integrationId, api_key: apiKey, action },
      });

      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-integrations"] });
    },
  });
}
