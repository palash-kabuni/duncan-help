import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isCEO } from "@/lib/ceoAccess";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Sparkles, Send, Settings2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useCEOBriefing, type BriefingType } from "@/hooks/useCEOBriefing";
import PulseBanner from "@/components/ceo/PulseBanner";
import RiskRadar from "@/components/ceo/RiskRadar";
import LeadershipGrid from "@/components/ceo/LeadershipGrid";
import TldrPanel from "@/components/ceo/TldrPanel";
import CoverageGaps from "@/components/ceo/CoverageGaps";
import CompanyPulseCard, { type CompanyPulseStatus } from "@/components/ceo/CompanyPulseCard";
import DataCoverageCard, { type DataCoverageAudit } from "@/components/ceo/DataCoverageCard";
import EmailPulseCard from "@/components/ceo/EmailPulseCard";
import SendActionsDialog from "@/components/ceo/SendActionsDialog";
import CEORoutingPanel from "@/components/ceo/CEORoutingPanel";
import { supabase } from "@/integrations/supabase/client";

const Section = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
      {String(n).padStart(2, "0")} · {title}
    </h2>
    {children}
  </section>
);

const CEOBriefing = () => {
  const { user, loading: authLoading } = useAuth();
  const [type, setType] = useState<BriefingType>("morning");
  const { briefing, previous, loading, generating, generate } = useCEOBriefing(type);
  const [sendOpen, setSendOpen] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  useEffect(() => {
    if (!briefing?.id) { setLastSent(null); return; }
    supabase
      .from("ceo_briefing_email_logs")
      .select("sent_at")
      .eq("briefing_id", briefing.id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLastSent(data?.sent_at ?? null));
  }, [briefing?.id]);

  if (authLoading) return null;
  if (!isCEO(user?.email)) return <Navigate to="/" replace />;

  const p = (briefing?.payload as any) || {};
  const today = briefing?.briefing_date ? new Date(briefing.briefing_date) : new Date();
  const dateLabel = today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const probDelta = briefing && previous && typeof briefing.outcome_probability === "number" && typeof previous.outcome_probability === "number"
    ? briefing.outcome_probability - previous.outcome_probability : null;
  const execDelta = briefing && previous && typeof briefing.execution_score === "number" && typeof previous.execution_score === "number"
    ? briefing.execution_score - previous.execution_score : null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 md:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">CEO Briefing</h1>
            <p className="text-sm text-muted-foreground font-mono">{dateLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={type} onValueChange={(v) => setType(v as BriefingType)}>
              <TabsList>
                <TabsTrigger value="morning">Morning</TabsTrigger>
                <TabsTrigger value="evening">Evening</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={generate} disabled={generating} size="sm">
              {generating ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
              {briefing ? "Regenerate" : "Generate"}
            </Button>
            {briefing && type === "morning" && (
              <Button onClick={() => setSendOpen(true)} disabled={generating} size="sm" variant="outline">
                <Send className="h-3.5 w-3.5 mr-2" />
                Send team actions
              </Button>
            )}
            {lastSent && (
              <Badge variant="outline" className="text-[10px] font-mono">
                Last sent {new Date(lastSent).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !briefing ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No {type} briefing yet for today.</p>
            <Button onClick={generate} disabled={generating}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate {type} briefing
            </Button>
          </div>
        ) : (
          <>
            <PulseBanner
              trajectory={briefing.trajectory ?? undefined}
              outcomeProbability={briefing.outcome_probability ?? 0}
              probabilityDelta={probDelta}
              executionScore={briefing.execution_score ?? 0}
              executionDelta={execDelta}
              coverageRatio={p.coverage_summary?.ratio ?? null}
              coverageCovered={p.coverage_summary?.covered ?? null}
              coverageTotal={p.coverage_summary?.total ?? null}
              confidenceWarning={p.confidence_warning?.reason ?? null}
            />

            {type === "morning" && p.tldr && <TldrPanel tldr={p.tldr} />}

            {type === "morning" && (
              <CoverageGaps gaps={p.coverage_gaps} totalPriorities={6} summary={p.coverage_summary} />
            )}

            {type === "morning" && Array.isArray(p.available_workstreams) && p.available_workstreams.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No workstreams configured in Duncan — add cards under{" "}
                  <Link to="/workstreams" className="text-primary underline">Workstreams</Link>{" "}
                  to enable scoring.
                </p>
              </div>
            )}

            {type === "morning" && Array.isArray(briefing.workstream_scores) && briefing.workstream_scores.length > 0 && (
              <Section n={0} title="Workstream Scorecard">
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-mono uppercase tracking-wider">Workstream</th>
                        <th className="px-3 py-2 font-mono uppercase tracking-wider">Prog</th>
                        <th className="px-3 py-2 font-mono uppercase tracking-wider">Conf</th>
                        <th className="px-3 py-2 font-mono uppercase tracking-wider">Risk</th>
                        <th className="px-3 py-2 font-mono uppercase tracking-wider">Framework axes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(briefing.workstream_scores as any[]).map((w, i) => (
                        <tr key={i} className="border-t border-border align-top">
                          <td className="px-3 py-2 text-foreground font-medium">{w.name}</td>
                          <td className="px-3 py-2 tabular-nums text-foreground">{w.progress ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums text-foreground">{w.confidence ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums text-foreground">{w.risk ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground space-y-1">
                            {w.progress_vs_goal && <div><span className="font-mono text-[10px] uppercase">Goal:</span> {w.progress_vs_goal}</div>}
                            {w.execution_quality && <div><span className="font-mono text-[10px] uppercase">Exec:</span> {w.execution_quality}</div>}
                            {w.commercial_impact && <div><span className="font-mono text-[10px] uppercase">$:</span> {w.commercial_impact}</div>}
                            {w.dependency_strength && <div><span className="font-mono text-[10px] uppercase">Deps:</span> {w.dependency_strength}</div>}
                            {w.evidence && <div className="text-[11px] italic">{w.evidence}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {type === "morning" ? (
              <>
                {p.company_pulse_status && (
                  <CompanyPulseCard pulse={p.company_pulse_status as CompanyPulseStatus} />
                )}

                <EmailPulseCard pulse={p.email_pulse} />

                {p.data_coverage_audit && (
                  <DataCoverageCard
                    audit={p.data_coverage_audit as DataCoverageAudit}
                    documentIntelligence={Array.isArray(p.document_intelligence) ? p.document_intelligence : []}
                    missingArtifacts={Array.isArray(p.missing_artifacts_recommendations) ? p.missing_artifacts_recommendations : []}
                    missingArtifactsSummary={p.missing_artifacts_summary}
                  />
                )}

                <Section n={1} title="Company Pulse — Narrative">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{p.company_pulse || "—"}</p>
                </Section>

                <Section n={2} title="Outcome Probability — June 7">
                  <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{briefing.outcome_probability ?? "—"}%</p>
                    <p className="text-xs text-muted-foreground">{p.probability_movement || "No movement context."}</p>
                  </div>
                </Section>

                <Section n={3} title="Execution Score">
                  <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{briefing.execution_score ?? "—"}/100</p>
                    <p className="text-xs text-muted-foreground">{p.execution_explanation || "—"}</p>
                  </div>
                </Section>

                <Section n={4} title="What Changed Yesterday">
                  <div className="space-y-3">
                    {(p.what_changed || []).map((g: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                        <h4 className="text-sm font-semibold text-foreground">{g.function_area || g.function}</h4>
                        {g.moved && <p className="text-xs text-muted-foreground"><span className="text-green-500 font-mono">MOVED:</span> {g.moved}</p>}
                        {g.did_not_move && <p className="text-xs text-muted-foreground"><span className="text-yellow-500 font-mono">STALLED:</span> {g.did_not_move}</p>}
                        {g.needs_attention && <p className="text-xs text-muted-foreground"><span className="text-red-500 font-mono">ATTENTION:</span> {g.needs_attention}</p>}
                      </div>
                    ))}
                  </div>
                </Section>

                <Section n={5} title="Strategic Risk Radar">
                  <RiskRadar risks={p.risks || []} reconciliation={p.risk_reconciliation || null} />
                </Section>

                <Section n={6} title="Cross-Functional Friction">
                  <div className="space-y-2">
                    {(p.friction || []).map((f: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">{f.issue}</h4>
                        {f.teams && <p className="text-[11px] font-mono text-muted-foreground">Teams: {Array.isArray(f.teams) ? f.teams.join(", ") : f.teams}</p>}
                        {f.consequence && <p className="text-xs text-muted-foreground">{f.consequence}</p>}
                      </div>
                    ))}
                  </div>
                </Section>

                <Section n={7} title="Leadership Performance">
                  <LeadershipGrid leaders={p.leadership || []} />
                </Section>

                <Section n={8} title="Accountability Watchlist">
                  <div className="rounded-lg border border-border bg-card overflow-x-auto">
                    <table className="w-full text-xs min-w-[720px]">
                      <thead className="bg-muted/50">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-mono uppercase tracking-wider">Workstream</th>
                          <th className="px-3 py-2 font-mono uppercase tracking-wider">Owner</th>
                          <th className="px-3 py-2 font-mono uppercase tracking-wider">Status</th>
                          <th className="px-3 py-2 font-mono uppercase tracking-wider">What Good Looks Like</th>
                          <th className="px-3 py-2 font-mono uppercase tracking-wider">Missing</th>
                          <th className="px-3 py-2 font-mono uppercase tracking-wider">Blind Spot</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(p.watchlist || []).map((w: any, i: number) => (
                          <tr key={i} className="border-t border-border align-top">
                            <td className="px-3 py-2 text-foreground font-medium">{w.workstream}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              <div>{w.owner}</div>
                              {w.reassignment_reason && (
                                <Badge variant="outline" className="mt-1 text-[9px] font-mono uppercase border-amber-500/40 text-amber-600 dark:text-amber-400">
                                  Reassigned — single-owner cap
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{w.status}</td>
                            <td className="px-3 py-2 text-muted-foreground">{w.good_looks_like || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{w.missing}</td>
                            <td className="px-3 py-2">
                              {w.data_blind_spot ? (
                                <div className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                  <span className="text-[11px]">{w.data_blind_spot}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>

                <Section n={9} title="Decisions the CEO Must Make">
                  <div className="space-y-3">
                    {(p.decisions || []).slice(0, 3).map((d: any, i: number) => {
                      const conf = (d.confidence || "").toLowerCase();
                      const confClass =
                        conf === "high"
                          ? "border-green-500/40 text-green-600 dark:text-green-400"
                          : conf === "medium"
                          ? "border-yellow-500/40 text-yellow-600 dark:text-yellow-400"
                          : conf === "low"
                          ? "border-red-500/40 text-red-600 dark:text-red-400"
                          : "border-border text-muted-foreground";
                      return (
                        <div key={i} className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-sm font-semibold text-foreground">{i + 1}. {d.decision}</h4>
                            {conf && (
                              <Badge variant="outline" className={`text-[10px] font-mono uppercase shrink-0 ${confClass}`}>
                                {conf} confidence
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{d.why_it_matters}</p>
                          {d.consequence && <p className="text-xs text-red-500">If ignored 7d: {d.consequence}</p>}
                          {d.who_to_involve && <p className="text-[11px] font-mono text-muted-foreground">Involve: {d.who_to_involve}</p>}
                          {d.blocked_by_missing_data && (
                            <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/5 p-2.5 flex items-start gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div className="flex-1 space-y-1.5">
                                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                  <span className="font-semibold">Decide blind?</span> {d.blocked_by_missing_data}
                                </p>
                                <Link
                                  to="/projects"
                                  className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  Upload to fix →
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section n={10} title="Automation Progress">
                  <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                    {typeof p.automation?.percent === "number" && (
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold tabular-nums text-foreground">{p.automation.percent}%</span>
                        <Badge variant="outline">target 25%</Badge>
                      </div>
                    )}
                    {p.automation?.working && <p className="text-xs text-muted-foreground"><span className="text-green-500 font-mono">WORKING:</span> {p.automation.working}</p>}
                    {p.automation?.manual && <p className="text-xs text-muted-foreground"><span className="text-yellow-500 font-mono">MANUAL:</span> {p.automation.manual}</p>}
                    {p.automation?.next && <p className="text-xs text-muted-foreground"><span className="text-primary font-mono">NEXT:</span> {p.automation.next}</p>}
                    {p.automation?.blockers && <p className="text-xs text-muted-foreground"><span className="text-red-500 font-mono">BLOCKERS:</span> {p.automation.blockers}</p>}
                  </div>
                </Section>

                <Section n={11} title="One Brutal Truth">
                  <div className="rounded-lg border-2 border-red-500/40 bg-red-500/5 p-6">
                    <p className="text-base font-medium text-foreground leading-relaxed">{p.brutal_truth || "—"}</p>
                  </div>
                </Section>
              </>
            ) : (
              <>
                <Section n={1} title="What Actually Got Done">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{p.got_done || "—"}</p>
                </Section>
                <Section n={2} title="What Slipped">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{p.slipped || "—"}</p>
                </Section>
                <Section n={3} title="New Risks Created">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{p.new_risks || "—"}</p>
                </Section>
                <Section n={4} title="Ownership Gaps">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{p.ownership_gaps || "—"}</p>
                </Section>
                <Section n={5} title="Execution Score">
                  <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <Badge variant="outline" className="text-base">{p.execution_rating || "—"}</Badge>
                    <p className="text-xs text-muted-foreground">{p.execution_explanation || "—"}</p>
                  </div>
                </Section>
                <Section n={6} title="What Must Be Fixed Tomorrow">
                  <ol className="space-y-2">
                    {(p.tomorrow_priorities || []).slice(0, 3).map((t: string, i: number) => (
                      <li key={i} className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
                        <span className="font-mono text-muted-foreground mr-2">{i + 1}.</span>{t}
                      </li>
                    ))}
                  </ol>
                </Section>
              </>
            )}

            <p className="text-[10px] font-mono text-muted-foreground/60 text-center pt-4">
              Generated {new Date(briefing.created_at).toLocaleString("en-GB")} · Locked to CEO
            </p>

            <div className="pt-4 border-t border-border">
              <button
                onClick={() => setShowRouting((v) => !v)}
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <Settings2 className="h-3 w-3" />
                {showRouting ? "Hide" : "Show"} action routing
              </button>
              {showRouting && <div className="mt-3"><CEORoutingPanel /></div>}
            </div>
          </>
        )}

        <SendActionsDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          briefingId={briefing?.id ?? null}
          briefingDate={briefing?.briefing_date}
          onSent={() => {
            if (briefing?.id) {
              supabase
                .from("ceo_briefing_email_logs")
                .select("sent_at")
                .eq("briefing_id", briefing.id)
                .eq("status", "sent")
                .order("sent_at", { ascending: false })
                .limit(1)
                .maybeSingle()
                .then(({ data }) => setLastSent(data?.sent_at ?? null));
            }
          }}
        />
      </div>
    </AppLayout>
  );
};

export default CEOBriefing;
