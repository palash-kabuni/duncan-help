import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, RefreshCw, Users, Briefcase, Loader2, CheckCircle, AlertCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { JobRolesManager } from "@/components/recruitment/JobRolesManager";

const Recruitment = () => {
  const { user } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [scoring, setScoring] = useState(false);

  // Check Gmail connection status
  const { data: gmailStatus } = useQuery({
    queryKey: ["gmail-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_integrations")
        .select("status, last_sync")
        .eq("integration_id", "gmail")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch candidates
  const { data: candidates, refetch: refetchCandidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch job roles
  const { data: jobRoles } = useQuery({
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

  const connectGmail = async () => {
    setConnecting(true);
    try {
      const res = await supabase.functions.invoke("gmail-auth");
      if (res.error) throw res.error;
      const { url } = res.data;
      window.location.href = url;
    } catch (err: any) {
      toast.error("Failed to start Gmail connection: " + err.message);
      setConnecting(false);
    }
  };

  const fetchCVs = async () => {
    setFetching(true);
    try {
      const res = await supabase.functions.invoke("fetch-gmail-cvs");
      if (res.error) throw res.error;
      const { ingested, skipped } = res.data;
      toast.success(`Fetched ${ingested} new CV(s), ${skipped} skipped.`);
      refetchCandidates();
    } catch (err: any) {
      toast.error("Failed to fetch CVs: " + err.message);
    } finally {
      setFetching(false);
    }
  };

  const scoreValues = async () => {
    setScoring(true);
    try {
      const res = await supabase.functions.invoke("score-cv-values");
      if (res.error) throw res.error;
      const { scored, failed } = res.data;
      toast.success(`Scored ${scored} candidate(s) on values. ${failed ? `${failed} failed.` : ""}`);
      refetchCandidates();
    } catch (err: any) {
      toast.error("Failed to score candidates: " + err.message);
    } finally {
      setScoring(false);
    }
  };

  const isGmailConnected = gmailStatus?.status === "connected";
  const roleMap = new Map((jobRoles ?? []).map((r: any) => [r.id, r.title]));

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recruitment</h1>
            <p className="text-sm text-muted-foreground">CV ingestion, job role matching & candidate scoring</p>
          </div>
        </div>

        {/* Gmail Connection Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Gmail Connection
              </CardTitle>
              <CardDescription>
                {isGmailConnected
                  ? `Connected · Last sync: ${gmailStatus?.last_sync ? new Date(gmailStatus.last_sync).toLocaleString() : "Never"}`
                  : "Connect Gmail to start fetching CVs"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isGmailConnected ? (
                <>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    <CheckCircle className="h-3 w-3 mr-1" /> Connected
                  </Badge>
                  <Button size="sm" onClick={fetchCVs} disabled={fetching}>
                    {fetching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Fetch CVs
                  </Button>
                </>
              ) : (
                <Button onClick={connectGmail} disabled={connecting}>
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                  Connect Gmail
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{candidates?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total Candidates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{jobRoles?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Active Roles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">
                    {candidates?.filter((c: any) => c.status === "unmatched").length ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Unmatched CVs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job Roles */}
        <JobRolesManager />

        {/* Candidates Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Candidates</CardTitle>
              <CardDescription>CVs ingested from Gmail</CardDescription>
            </div>
            {candidates && candidates.length > 0 && (
              <Button size="sm" onClick={scoreValues} disabled={scoring}>
                {scoring ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Star className="h-4 w-4 mr-1" />}
                Score Values
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {candidates && candidates.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Competency</TableHead>
                    <TableHead>Values</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{c.email}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{c.email_subject}</TableCell>
                      <TableCell>
                        {c.job_role_id ? (
                          <Badge variant="outline">{roleMap.get(c.job_role_id) || "Unknown"}</Badge>
                        ) : (
                          <Badge variant="secondary">Unmatched</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.status === "scored" ? "default" : c.status === "unmatched" ? "destructive" : "secondary"}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.competency_score ?? "—"}</TableCell>
                      <TableCell>{c.values_score ?? "—"}</TableCell>
                      <TableCell className="font-semibold">{c.total_score ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No candidates yet. Connect Gmail and fetch CVs to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Recruitment;
