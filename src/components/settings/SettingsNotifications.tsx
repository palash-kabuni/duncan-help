import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, MessageSquare, Clock, AlertTriangle } from "lucide-react";

export default function SettingsNotifications() {
  const [emailNotif, setEmailNotif] = useState(true);
  const [activityAlerts, setActivityAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [mentionAlerts, setMentionAlerts] = useState(true);
  const [slackOverdueEnabled, setSlackOverdueEnabled] = useState(true);
  const [slackReminderFrequency, setSlackReminderFrequency] = useState("24");
  const [slackEscalation, setSlackEscalation] = useState(true);
  const [slackOwnerNotify, setSlackOwnerNotify] = useState(true);
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

      {/* General Notifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="text-sm text-foreground">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive updates via email</p>
            </div>
          </div>
          <Switch checked={emailNotif} onCheckedChange={toggle(setEmailNotif)} />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="text-sm text-foreground">Activity Alerts</Label>
              <p className="text-xs text-muted-foreground">Important system events</p>
            </div>
          </div>
          <Switch checked={activityAlerts} onCheckedChange={toggle(setActivityAlerts)} />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="text-sm text-foreground">Mention Alerts</Label>
              <p className="text-xs text-muted-foreground">When you're mentioned in discussions</p>
            </div>
          </div>
          <Switch checked={mentionAlerts} onCheckedChange={toggle(setMentionAlerts)} />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="text-sm text-foreground">Weekly Digest</Label>
              <p className="text-xs text-muted-foreground">Summary of the week's activity</p>
            </div>
          </div>
          <Switch checked={weeklyDigest} onCheckedChange={toggle(setWeeklyDigest)} />
        </div>
      </div>

      {/* Slack Overdue Task Notifications */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground">Slack Overdue Reminders</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Workstreams
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Automatically notify assignees in Slack when workstream tasks are overdue
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm text-foreground">Overdue Task Alerts</Label>
                <p className="text-xs text-muted-foreground">Send Slack DM when a task passes its due date</p>
              </div>
            </div>
            <Switch checked={slackOverdueEnabled} onCheckedChange={toggle(setSlackOverdueEnabled)} />
          </div>

          <Separator className="bg-border" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Reminder Frequency</Label>
              <p className="text-xs text-muted-foreground">How often to re-notify for still-overdue tasks</p>
            </div>
            <Select
              value={slackReminderFrequency}
              onValueChange={(v) => { setSlackReminderFrequency(v); setDirty(true); }}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">Every 12 hours</SelectItem>
                <SelectItem value="24">Every 24 hours</SelectItem>
                <SelectItem value="48">Every 48 hours</SelectItem>
                <SelectItem value="0">Once only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Owner Escalation</Label>
              <p className="text-xs text-muted-foreground">Notify card owner after 3 days overdue</p>
            </div>
            <Switch checked={slackOwnerNotify} onCheckedChange={toggle(setSlackOwnerNotify)} />
          </div>

          <Separator className="bg-border" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Auto Status Escalation</Label>
              <p className="text-xs text-muted-foreground">
                Automatically move cards to Amber (5d) or Red (7d) if tasks remain overdue
              </p>
            </div>
            <Switch checked={slackEscalation} onCheckedChange={toggle(setSlackEscalation)} />
          </div>
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
