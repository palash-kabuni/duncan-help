import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Shield, Key } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SettingsPrivacy() {
  const { user } = useAuth();
  const [dataSharing, setDataSharing] = useState(false);
  const [analyticsTracking, setAnalyticsTracking] = useState(true);

  const handleResetPassword = () => {
    toast.info("Password reset link sent to your email");
  };

  const handleExportData = () => {
    toast.info("Data export requested — you'll receive it via email");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Privacy & Security</h3>
        <p className="text-xs text-muted-foreground">Manage your security preferences</p>
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium text-foreground">Authentication</Label>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Signed in as <span className="font-mono text-foreground">{user?.email}</span>
        </p>
        <button
          onClick={handleResetPassword}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
        >
          <Key className="h-3.5 w-3.5" />
          Change Password
        </button>
      </div>

      <Separator className="bg-border" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-foreground">Analytics Tracking</Label>
            <p className="text-xs text-muted-foreground">Help improve Duncan with usage data</p>
          </div>
          <Switch checked={analyticsTracking} onCheckedChange={setAnalyticsTracking} />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-foreground">Data Sharing</Label>
            <p className="text-xs text-muted-foreground">Share anonymised data for AI improvements</p>
          </div>
          <Switch checked={dataSharing} onCheckedChange={setDataSharing} />
        </div>
      </div>

      <Separator className="bg-border" />

      <div>
        <h4 className="text-xs font-semibold text-foreground mb-2">Data Management</h4>
        <button
          onClick={handleExportData}
          className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
        >
          Export My Data
        </button>
      </div>
    </div>
  );
}
