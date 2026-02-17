import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WikiCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface WikiPage {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category_id: string | null;
  tags: string[];
  created_by: string;
  updated_by: string | null;
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export function useWikiCategories() {
  return useQuery({
    queryKey: ["wiki-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as WikiCategory[];
    },
  });
}

export function useWikiPages(categoryId?: string | null, search?: string) {
  return useQuery({
    queryKey: ["wiki-pages", categoryId, search],
    queryFn: async () => {
      let query = supabase
        .from("wiki_pages")
        .select("*")
        .eq("is_published", true)
        .order("updated_at", { ascending: false });

      if (categoryId) query = query.eq("category_id", categoryId);
      if (search) query = query.ilike("title", `%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as WikiPage[];
    },
  });
}

export function useWikiPage(id: string | null) {
  return useQuery({
    queryKey: ["wiki-page", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wiki_pages")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as WikiPage;
    },
  });
}

export function useCreateWikiPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (page: { title: string; content: string; summary?: string; category_id?: string; tags?: string[] }) => {
      const { data, error } = await supabase
        .from("wiki_pages")
        .insert({ ...page, created_by: user!.id, updated_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as WikiPage;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wiki-pages"] }),
  });
}

export function useUpdateWikiPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string; summary?: string; category_id?: string | null; tags?: string[] }) => {
      const { data, error } = await supabase
        .from("wiki_pages")
        .update({ ...updates, updated_by: user!.id })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as WikiPage;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["wiki-pages"] });
      qc.invalidateQueries({ queryKey: ["wiki-page", data.id] });
    },
  });
}

export function useDeleteWikiPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wiki_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wiki-pages"] }),
  });
}
