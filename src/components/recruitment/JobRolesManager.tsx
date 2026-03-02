import { useState, useRef } from "react";
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
import { Briefcase, Plus, Loader2, Trash2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

export function JobRolesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      let jdStoragePath: string | null = null;

      // Upload JD if provided
      if (jdFile) {
        const ext = jdFile.name.split(".").pop()?.toLowerCase();
        if (!["pdf", "docx", "doc"].includes(ext || "")) {
          toast.error("JD must be a PDF, DOCX, or DOC file");
          setSaving(false);
          return;
        }
        jdStoragePath = `${Date.now()}_${jdFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("job-descriptions")
          .upload(jdStoragePath, jdFile, { contentType: jdFile.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const insertData: any = {
        title: title.trim(),
        description: description.trim() || null,
        created_by: user.id,
      };
      if (jdStoragePath) {
        insertData.jd_storage_path = jdStoragePath;
      }

      const { data: newRole, error } = await supabase.from("job_roles").insert(insertData).select().single();
      if (error) throw error;

      // If JD was uploaded, parse competencies via AI
      if (jdStoragePath && newRole) {
        toast.info("Parsing JD for competencies...");
        try {
          const res = await supabase.functions.invoke("parse-jd-competencies", {
            body: { job_role_id: newRole.id, storage_path: jdStoragePath },
          });
          if (res.error) throw res.error;
          const competencies = res.data?.competencies || [];
          toast.success(`Extracted ${competencies.length} competencies from JD`);
        } catch (err: any) {
          toast.warning("Role created but JD parsing failed: " + err.message);
        }
      }

      toast.success(`Role "${title.trim()}" created`);
      setTitle("");
      setDescription("");
      setJdFile(null);
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
            <div className="space-y-1.5">
              <Label>Job Description (PDF/DOCX)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                  onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {jdFile ? "Change File" : "Upload JD"}
                </Button>
                {jdFile && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {jdFile.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a JD to auto-extract competencies for candidate scoring
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Role
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setTitle(""); setDescription(""); setJdFile(null); }}>
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
                <TableHead>Competencies</TableHead>
                <TableHead>JD</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobRoles.map((role: any) => {
                const competencies = Array.isArray(role.competencies) ? role.competencies : [];
                return (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.title}</TableCell>
                    <TableCell>
                      {competencies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {competencies.slice(0, 3).map((c: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              {typeof c === "string" ? c : c.name || c.title}
                            </Badge>
                          ))}
                          {competencies.length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{competencies.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {role.jd_storage_path ? (
                        <Badge variant="outline" className="text-[10px]">
                          <FileText className="h-3 w-3 mr-1" /> Uploaded
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
                );
              })}
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
