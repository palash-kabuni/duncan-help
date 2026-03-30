import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { Check, X, Loader2, Clock, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

interface PendingProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  department: string | null;
  role_title: string | null;
  requested_role_title: string | null;
  approval_status: string;
  created_at: string;
}

export default function AccountApprovals() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["pending-approvals"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, department, role_title, requested_role_title, approval_status, created_at")
        .in("approval_status", ["pending", "rejected"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PendingProfile[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: status } as any)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      toast.success(status === "approved" ? "Account approved" : "Account rejected");
    },
    onError: (e) => toast.error(e.message),
  });

  if (adminLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const pending = profiles.filter((p) => p.approval_status === "pending");
  const rejected = profiles.filter((p) => p.approval_status === "rejected");

  return (
    <div className="space-y-4">
      {pending.length === 0 && rejected.length === 0 ? (
        <div className="text-center py-8">
          <UserCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No pending approvals</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Pending ({pending.length})
              </p>
              {pending.map((p) => (
                <ApprovalCard key={p.id} profile={p} onAction={approveMutation.mutate} isPending={approveMutation.isPending} />
              ))}
            </div>
          )}
          {rejected.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserX className="h-3.5 w-3.5" />
                Rejected ({rejected.length})
              </p>
              {rejected.map((p) => (
                <ApprovalCard key={p.id} profile={p} onAction={approveMutation.mutate} isPending={approveMutation.isPending} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ApprovalCard({
  profile,
  onAction,
  isPending,
}: {
  profile: PendingProfile;
  onAction: (args: { userId: string; status: "approved" | "rejected" }) => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{profile.display_name || "Unnamed"}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {profile.department && (
            <span className="text-xs text-muted-foreground">{profile.department}</span>
          )}
          {profile.requested_role_title && (
            <span className="text-xs text-muted-foreground">• {profile.requested_role_title}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-1">
          {new Date(profile.created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          disabled={isPending}
          onClick={() => onAction({ userId: profile.user_id, status: "approved" })}
          className="flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
        {profile.approval_status !== "rejected" && (
          <button
            disabled={isPending}
            onClick={() => onAction({ userId: profile.user_id, status: "rejected" })}
            className="flex items-center gap-1 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
