import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Users, Bell, AlertTriangle } from "lucide-react";

interface MappingRow {
  id: string;
  duncan_user_id: string;
  basecamp_person_id: number;
  basecamp_name: string;
  slack_user_identifier: string;
  is_active: boolean;
}

interface ProfileOption {
  id: string;
  user_id: string;
  display_name: string | null;
}

export default function UserMappingManager() {
  const queryClient = useQueryClient();
  const [newMapping, setNewMapping] = useState({
    duncan_user_id: "",
    basecamp_person_id: "",
    basecamp_name: "",
    slack_user_identifier: "",
  });

  // Fetch mappings
  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["user-notification-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notification_mappings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MappingRow[];
    },
  });

  // Fetch profiles for dropdown
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, display_name")
        .order("display_name");
      if (error) throw error;
      return data as ProfileOption[];
    },
  });

  // Fetch unmapped users log
  const { data: unmappedLogs = [] } = useQuery({
    queryKey: ["unmapped-users-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unmapped_users_log")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch recent notification logs
  const { data: recentLogs = [] } = useQuery({
    queryKey: ["slack-notification-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slack_notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
  });

  // Add mapping
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_notification_mappings").insert({
        duncan_user_id: newMapping.duncan_user_id,
        basecamp_person_id: parseInt(newMapping.basecamp_person_id),
        basecamp_name: newMapping.basecamp_name,
        slack_user_identifier: newMapping.slack_user_identifier,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notification-mappings"] });
      setNewMapping({ duncan_user_id: "", basecamp_person_id: "", basecamp_name: "", slack_user_identifier: "" });
      toast.success("Mapping added");
    },
    onError: (e) => toast.error(e.message),
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("user_notification_mappings")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notification-mappings"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // Delete mapping
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notification_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notification-mappings"] });
      toast.success("Mapping removed");
    },
    onError: (e) => toast.error(e.message),
  });

  // Run digest manually
  const runDigestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("basecamp-morning-digest");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["slack-notification-logs"] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-users-log"] });
      toast.success(`Digest generated: ${data.digests_generated} users, ${data.unmapped_users} unmapped`);
    },
    onError: (e) => toast.error(e.message),
  });

  const canAdd = newMapping.duncan_user_id && newMapping.basecamp_person_id && newMapping.basecamp_name && newMapping.slack_user_identifier;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Morning Digest Mappings
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Map Basecamp users → Duncan profiles → Slack destinations
          </p>
        </div>
        <Button onClick={() => runDigestMutation.mutate()} disabled={runDigestMutation.isPending} variant="outline" size="sm">
          {runDigestMutation.isPending ? "Running..." : "Run Digest Now"}
        </Button>
      </div>

      {/* Add new mapping */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Mapping
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Duncan User</label>
              <Select value={newMapping.duncan_user_id} onValueChange={(v) => setNewMapping({ ...newMapping, duncan_user_id: v })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || p.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Basecamp Person ID</label>
              <Input
                className="h-9 text-xs"
                type="number"
                placeholder="e.g. 12345678"
                value={newMapping.basecamp_person_id}
                onChange={(e) => setNewMapping({ ...newMapping, basecamp_person_id: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Basecamp Name</label>
              <Input
                className="h-9 text-xs"
                placeholder="e.g. John Smith"
                value={newMapping.basecamp_name}
                onChange={(e) => setNewMapping({ ...newMapping, basecamp_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Slack Identifier</label>
              <Input
                className="h-9 text-xs"
                placeholder="email or Slack ID"
                value={newMapping.slack_user_identifier}
                onChange={(e) => setNewMapping({ ...newMapping, slack_user_identifier: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button size="sm" className="h-9 w-full" disabled={!canAdd || addMutation.isPending} onClick={() => addMutation.mutate()}>
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing mappings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Mappings ({mappings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mappings yet. Add one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Basecamp Name</TableHead>
                  <TableHead className="text-xs">Person ID</TableHead>
                  <TableHead className="text-xs">Duncan User</TableHead>
                  <TableHead className="text-xs">Slack ID</TableHead>
                  <TableHead className="text-xs">Active</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => {
                  const profile = profiles.find((p) => p.id === m.duncan_user_id);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs font-medium">{m.basecamp_name}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{m.basecamp_person_id}</TableCell>
                      <TableCell className="text-xs">{profile?.display_name || m.duncan_user_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs font-mono">{m.slack_user_identifier}</TableCell>
                      <TableCell>
                        <Switch
                          checked={m.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: m.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(m.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Unmapped users */}
      {unmappedLogs.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Unmapped Basecamp Users
            </CardTitle>
            <CardDescription className="text-xs">These users were found in Basecamp but have no mapping.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {unmappedLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/50">
                  <span className="font-medium">{log.basecamp_name}</span>
                  <span className="font-mono text-muted-foreground">ID: {log.basecamp_person_id}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent digest logs */}
      {recentLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent Digest Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/50">
                  <span className="font-mono">{log.slack_user_identifier}</span>
                  <Badge variant="outline" className="text-[10px]">{log.status}</Badge>
                  <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
