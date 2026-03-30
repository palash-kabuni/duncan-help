import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function SettingsNotifications() {
  const [emailNotif, setEmailNotif] = useState(true);
  const [activityAlerts, setActivityAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [mentionAlerts, setMentionAlerts] = useState(true);
  const [dirty, setDirty] = useState(false);

  const toggle = (setter: (v: boolean) => void) => (v: boolean) => {
    setter(v);
    setDirty(true);
  };

  const handleSave = () => {
    toast.success("Notification preferences saved");
    setDirty(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Notifications</h3>
        <p className="text-xs text-muted-foreground">Control how Duncan notifies you</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-foreground">Email Notifications</Label>
            <p className="text-xs text-muted-foreground">Receive updates via email</p>
          </div>
          <Switch checked={emailNotif} onCheckedChange={toggle(setEmailNotif)} />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-foreground">Activity Alerts</Label>
            <p className="text-xs text-muted-foreground">Important system events</p>
          </div>
          <Switch checked={activityAlerts} onCheckedChange={toggle(setActivityAlerts)} />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-foreground">Mention Alerts</Label>
            <p className="text-xs text-muted-foreground">When you're mentioned in discussions</p>
          </div>
          <Switch checked={mentionAlerts} onCheckedChange={toggle(setMentionAlerts)} />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-foreground">Weekly Digest</Label>
            <p className="text-xs text-muted-foreground">Summary of the week's activity</p>
          </div>
          <Switch checked={weeklyDigest} onCheckedChange={toggle(setWeeklyDigest)} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
