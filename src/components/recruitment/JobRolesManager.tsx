import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function JobRolesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: jobRoles, isLoading } = useQuery({
    queryKey: ["job-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_roles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Role title is required");
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("job_roles").insert({
        title: title.trim(),
        description: description.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(`Role "${title.trim()}" created`);
      setTitle("");
      setDescription("");
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["job-roles"] });
    } catch (err: any) {
      toast.error("Failed to create role: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, roleTitle: string) => {
    try {
      const { error } = await supabase.from("job_roles").delete().eq("id", id);
      if (error) throw error;
      toast.success(`Role "${roleTitle}" deleted`);
      queryClient.invalidateQueries({ queryKey: ["job-roles"] });
    } catch (err: any) {
      toast.error("Failed to delete role: " + err.message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Job Roles
          </CardTitle>
          <CardDescription>
            Define roles so Duncan searches Gmail for CVs with matching subject lines
          </CardDescription>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Role
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="space-y-1.5">
              <Label htmlFor="role-title">Role Title</Label>
              <Input
                id="role-title"
                placeholder="e.g. Interior Designer, Project Manager"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Gmail will be searched for emails with this title in the subject line
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description (optional)</Label>
              <Textarea
                id="role-desc"
                placeholder="Brief description of the role..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Role
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setTitle(""); setDescription(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : jobRoles && jobRoles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobRoles.map((role: any) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                    {role.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.status === "active" ? "default" : "secondary"}>
                      {role.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(role.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(role.id, role.title)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No roles yet. Add a role to start matching CVs from Gmail.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
