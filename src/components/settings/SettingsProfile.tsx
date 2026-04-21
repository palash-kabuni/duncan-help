import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, ProfileData } from "@/hooks/useProfile";
import { useDepartments } from "@/hooks/useDepartments";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, User, Briefcase, Building2 } from "lucide-react";
import duncanAvatar from "@/assets/duncan-avatar.jpeg";
import { toast } from "sonner";

export default function SettingsProfile() {
  const { user } = useAuth();
  const { profile, isLoading, updateProfile, isSaving } = useProfile();
  const { data: departments = [] } = useDepartments();

  const [form, setForm] = useState<Partial<ProfileData>>({
    display_name: "",
    role_title: "",
    department: "",
    bio: "",
    norman_context: "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        role_title: profile.role_title ?? "",
        department: profile.department ?? "",
        bio: profile.bio ?? "",
        norman_context: profile.norman_context ?? "",
      });
      setDirty(false);
    }
  }, [profile]);

  const set = (key: keyof ProfileData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!form.display_name?.trim()) {
      toast.error("Display name is required");
      return;
    }
    updateProfile(form);
    setDirty(false);
  };

  const handleCancel = () => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        role_title: profile.role_title ?? "",
        department: profile.department ?? "",
        bio: profile.bio ?? "",
        norman_context: profile.norman_context ?? "",
      });
      setDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Profile</h3>
        <p className="text-xs text-muted-foreground">Help Duncan understand who you are</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Display Name
          </Label>
          <Input
            value={form.display_name ?? ""}
            onChange={(e) => set("display_name", e.target.value)}
            placeholder="e.g. Nimesh Patel"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Role / Title
          </Label>
          <Input
            value={form.role_title ?? ""}
            onChange={(e) => set("role_title", e.target.value)}
            placeholder="e.g. Head of Operations"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Department
          </Label>
          <Input
            value={form.department ?? ""}
            onChange={(e) => set("department", e.target.value)}
            placeholder="e.g. Operations"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">About You</Label>
          <Textarea
            value={form.bio ?? ""}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="A brief description of what you do…"
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <img src={duncanAvatar} alt="" className="h-3.5 w-3.5 rounded-sm object-cover object-[50%_30%] scale-150" />
            Duncan Personalisation
          </Label>
          <p className="text-[11px] text-muted-foreground/60">
            Communication style, priorities, projects you're focused on.
          </p>
          <Textarea
            value={form.norman_context ?? ""}
            onChange={(e) => set("norman_context", e.target.value)}
            placeholder="e.g. I prefer concise bullet-point answers…"
            className="min-h-[80px]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-[11px] text-muted-foreground">
          {user?.email}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <button
              onClick={handleCancel}
              className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
