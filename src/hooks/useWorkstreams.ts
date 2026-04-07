import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type CardStatus = "red" | "amber" | "green" | "done";
export type CardPriority = "low" | "medium" | "high" | "critical";

export interface WorkstreamCard {
  id: string;
  title: string;
  description: string;
  status: CardStatus;
  priority: CardPriority;
  owner_id: string | null;
  due_date: string | null;
  project_tag: string | null;
  created_by: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  tasks_total?: number;
  tasks_completed?: number;
  owner_name?: string;
}

export interface WorkstreamTask {
  id: string;
  card_id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  assignee_name?: string;
}

export interface WorkstreamComment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
}

export interface WorkstreamActivity {
  id: string;
  card_id: string;
  user_id: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
  user_name?: string;
}

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  role_title: string | null;
  avatar_url: string | null;
}

// Fetch all user profiles for assignment dropdowns
export function useUserProfiles() {
  return useQuery({
    queryKey: ["user-profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, role_title, avatar_url")
        .eq("approval_status", "approved")
        .order("display_name");
      if (error) throw error;
      return (data || []) as UserProfile[];
    },
  });
}

// Fetch all cards with task counts
export function useWorkstreamCards(filters?: {
  status?: CardStatus;
  assignee?: string;
  priority?: CardPriority;
  project_tag?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["workstream-cards", filters],
    queryFn: async () => {
      // First get cards
      let query = supabase
        .from("workstream_cards")
        .select("*")
        .is("archived_at", null)
        .order("updated_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.assignee) query = query.eq("owner_id", filters.assignee);
      if (filters?.priority) query = query.eq("priority", filters.priority);
      if (filters?.project_tag) query = query.eq("project_tag", filters.project_tag);
      if (filters?.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);

      const { data: cards, error } = await query;
      if (error) throw error;
      if (!cards || cards.length === 0) return [];

      // Get task counts per card
      const cardIds = cards.map(c => c.id);
      const { data: tasks } = await supabase
        .from("workstream_tasks")
        .select("card_id, completed")
        .in("card_id", cardIds);

      // Get owner profiles
      const ownerIds = [...new Set(cards.map(c => c.owner_id).filter(Boolean))] as string[];
      let profileMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ownerIds);
        profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.user_id]: p.display_name || "Unknown" }), {});
      }

      // Aggregate
      const taskCounts: Record<string, { total: number; completed: number }> = {};
      (tasks || []).forEach(t => {
        if (!taskCounts[t.card_id]) taskCounts[t.card_id] = { total: 0, completed: 0 };
        taskCounts[t.card_id].total++;
        if (t.completed) taskCounts[t.card_id].completed++;
      });

      return cards.map(c => ({
        ...c,
        status: c.status as CardStatus,
        priority: c.priority as CardPriority,
        tasks_total: taskCounts[c.id]?.total || 0,
        tasks_completed: taskCounts[c.id]?.completed || 0,
        owner_name: c.owner_id ? profileMap[c.owner_id] : undefined,
      })) as WorkstreamCard[];
    },
  });
}

// Fetch single card with full details
export function useWorkstreamCard(cardId: string | null) {
  return useQuery({
    queryKey: ["workstream-card", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      if (!cardId) return null;

      const { data: card, error } = await supabase
        .from("workstream_cards")
        .select("*")
        .eq("id", cardId)
        .single();
      if (error) throw error;

      // Fetch tasks
      const { data: tasks } = await supabase
        .from("workstream_tasks")
        .select("*")
        .eq("card_id", cardId)
        .order("sort_order");

      // Fetch comments
      const { data: comments } = await supabase
        .from("workstream_comments")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false });

      // Fetch activity
      const { data: activity } = await supabase
        .from("workstream_activity")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(50);

      // Get all user IDs for name resolution
      const userIds = new Set<string>();
      if (card.owner_id) userIds.add(card.owner_id);
      userIds.add(card.created_by);
      (tasks || []).forEach(t => { if (t.assignee_id) userIds.add(t.assignee_id); });
      (comments || []).forEach(c => userIds.add(c.user_id));
      (activity || []).forEach(a => userIds.add(a.user_id));

      let profileMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", [...userIds]);
        profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.user_id]: p.display_name || "Unknown" }), {});
      }

      return {
        card: { ...card, status: card.status as CardStatus, priority: card.priority as CardPriority, owner_name: card.owner_id ? profileMap[card.owner_id] : undefined } as WorkstreamCard,
        tasks: (tasks || []).map(t => ({ ...t, assignee_name: t.assignee_id ? profileMap[t.assignee_id] : undefined })) as WorkstreamTask[],
        comments: (comments || []).map(c => ({ ...c, user_name: profileMap[c.user_id] })) as WorkstreamComment[],
        activity: (activity || []).map(a => ({ ...a, user_name: profileMap[a.user_id] })) as WorkstreamActivity[],
      };
    },
  });
}

// Mutations
export function useCreateCard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; status?: CardStatus; priority?: CardPriority; owner_id?: string; due_date?: string; project_tag?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("workstream_cards")
        .insert({ ...input, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;

      // Log activity
      await supabase.from("workstream_activity").insert({
        card_id: data.id,
        user_id: user.id,
        action: "card_created",
        details: { title: input.title },
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workstream-cards"] });
      toast.success("Card created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkstreamCard> & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("workstream_cards")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Log status change specifically
      if (updates.status) {
        await supabase.from("workstream_activity").insert({
          card_id: id,
          user_id: user.id,
          action: "status_changed",
          details: { new_status: updates.status },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workstream-cards"] });
      qc.invalidateQueries({ queryKey: ["workstream-card"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workstream_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workstream-cards"] });
      toast.success("Card deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Task mutations
export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { card_id: string; title: string; description?: string; assignee_id?: string; due_date?: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("workstream_tasks")
        .insert(input)
        .select()
        .single();
      if (error) throw error;

      if (user) {
        await supabase.from("workstream_activity").insert({
          card_id: input.card_id,
          user_id: user.id,
          action: "task_added",
          details: { title: input.title },
        });
      }
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workstream-card", vars.card_id] });
      qc.invalidateQueries({ queryKey: ["workstream-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, card_id, ...updates }: Partial<WorkstreamTask> & { id: string; card_id: string }) => {
      const { error } = await supabase
        .from("workstream_tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      if (user && updates.completed !== undefined) {
        await supabase.from("workstream_activity").insert({
          card_id,
          user_id: user.id,
          action: updates.completed ? "task_completed" : "task_uncompleted",
          details: { task_id: id },
        });
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workstream-card", vars.card_id] });
      qc.invalidateQueries({ queryKey: ["workstream-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, card_id }: { id: string; card_id: string }) => {
      const { error } = await supabase.from("workstream_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workstream-card", vars.card_id] });
      qc.invalidateQueries({ queryKey: ["workstream-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Comment mutations
export function useAddComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { card_id: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("workstream_comments")
        .insert({ ...input, user_id: user.id });
      if (error) throw error;

      await supabase.from("workstream_activity").insert({
        card_id: input.card_id,
        user_id: user.id,
        action: "comment_added",
        details: {},
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workstream-card", vars.card_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, card_id }: { id: string; card_id: string }) => {
      const { error } = await supabase.from("workstream_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workstream-card", vars.card_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
