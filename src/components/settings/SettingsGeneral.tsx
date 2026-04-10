import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LogOut, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AccountApprovals from "./AccountApprovals";

export default function SettingsGeneral() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useIsAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Account</h3>
        <p className="text-xs text-muted-foreground">Your account information</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          <p className="text-sm text-foreground mt-1">{user?.email ?? "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Display Name</Label>
          <p className="text-sm text-foreground mt-1">{profile?.display_name ?? "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Department</Label>
          <p className="text-sm text-foreground mt-1">{profile?.department ?? "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Role</Label>
          <p className="text-sm text-foreground mt-1">{profile?.role_title ?? "—"}</p>
        </div>
      </div>

      <Separator className="bg-border" />

      <button
        onClick={signOut}
        className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>

      {isAdmin && (
        <>
          <Separator className="bg-border" />
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Account Approvals</h3>
            <AccountApprovals />
          </div>
        </>
      )}
    </div>
  );
}
