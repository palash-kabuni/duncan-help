import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { POCategory } from "./usePurchaseOrders";

export interface Budget {
  id: string;
  department_id: string;
  category: POCategory;
  fiscal_year: number;
  allocated_amount: number;
  spent_amount: number;
  created_at: string;
  updated_at: string;
}

export function useBudgets(fiscalYear?: number) {
  const { user } = useAuth();
  const year = fiscalYear ?? new Date().getFullYear();

  return useQuery({
    queryKey: ["budgets", year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("fiscal_year", year)
        .order("department_id");
      if (error) throw error;
      return data as Budget[];
    },
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (budget: {
      department_id: string;
      category: POCategory;
      fiscal_year: number;
      allocated_amount: number;
    }) => {
      const { data, error } = await supabase
        .from("budgets")
        .upsert(budget, { onConflict: "department_id,category,fiscal_year" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast({ title: "Budget saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useBulkUpsertBudgets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (budgets: {
      department_id: string;
      category: POCategory;
      fiscal_year: number;
      allocated_amount: number;
    }[]) => {
      const { error } = await supabase
        .from("budgets")
        .upsert(budgets, { onConflict: "department_id,category,fiscal_year" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast({ title: "Budgets imported successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Import error", description: err.message, variant: "destructive" });
    },
  });
}
