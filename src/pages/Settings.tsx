import { useState } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, User, Bell, Shield, LogOut } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [activityAlerts, setActivityAlerts] = useState(true);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        <div className="relative z-10 px-8 py-8 max-w-3xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Settings</h2>
            </div>
            <p className="text-sm text-muted-foreground font-mono">Manage your account and preferences</p>
          </motion.div>

          {/* Account Section */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Account</h3>
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
          </motion.section>

          {/* Notifications Section */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-border bg-card p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Activity Alerts</p>
                  <p className="text-xs text-muted-foreground">Get notified about important actions</p>
                </div>
                <Switch checked={activityAlerts} onCheckedChange={setActivityAlerts} />
              </div>
            </div>
          </motion.section>

          {/* Security Section */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-card p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Security</h3>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Authentication</Label>
                <p className="text-sm text-foreground mt-1">Email & Password</p>
              </div>
              <Separator className="bg-border" />
              <button
                onClick={signOut}
                className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </motion.section>

          <p className="text-[10px] font-mono text-muted-foreground/40 text-center mt-8">
            Duncan · KabuniOS v0.1
          </p>
        </div>
      </main>
    </div>
  );
};

export default Settings;
