import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, AlertTriangle, CheckCircle2, MinusCircle, FileText, ShoppingBag, MapPin, Zap, Target, Activity } from "lucide-react";
import { useState } from "react";

export type DocumentIntelligenceEntry = {
  domain: string;
  file_name: string;
  verdict: "weak" | "adequate" | "strong";
  what_it_covers?: string;
  what_is_missing_in_doc?: string;
  contradicted_by?: string[];
  reinforced_by?: string[];
  critical_gaps_to_fix?: string[];
};

export type MissingArtifact = {
  name: string;
  why_duncan_needs_it?: string;
  what_it_unlocks?: string;
  where_to_find_it?: string;
  suggested_filename_pattern?: string;
  blast_radius?: string[];
};

export type MissingArtifactsRecommendation = {
  domain: string;
  priority: "critical" | "high" | "medium" | "low";
  artifacts: MissingArtifact[];
};

export type MissingArtifactsSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type DataCoverageDomain = {
  id: string;
  label: string;
  status: "green" | "yellow" | "red";
  critical: boolean;
  needs: string;
  evidence: string;
  matched_signals?: string[];
  recommendation: string | null;
  prefill_tag: string;
  // Strategic-coverage fields (new)
  strategic_required?: number;
  strategic_supplied?: number;
  strategic_pct?: number;
  blind_priorities?: string[];
  missing_artifacts?: string[];
  live_signal?: "active" | "quiet";
};

export type StrategicCoverageDomainRow = {
  domain: string;
  domain_label: string;
  required: string[];
  supplied: Array<{ name: string; likely_supplied_as: string; source: string }>;
  missing: string[];
};

export type StrategicCoveragePriority = {
  priority_id: string;
  priority_title: string;
  coverage_pct: number;
  status: "green" | "yellow" | "red";
  by_domain: StrategicCoverageDomainRow[];
  total_required: number;
  total_supplied: number;
};

export type DataCoverageAudit = {
  domains: DataCoverageDomain[];
  counts: { red: number; yellow: number; green: number; total: number };
  confidence_cap: "high" | "medium" | "low";
  cap_reason: string;
  worst_red_domain: { id: string; label: string; recommendation: string | null } | null;
  critical_reds: Array<{ id: string; label: string; recommendation: string | null }>;
  document_review_summary?: { documents_reviewed: number; weak: number; adequate: number; strong: number };
  strategic_coverage?: StrategicCoveragePriority[];
  overall_strategic_pct?: number;
};

const dotClass = (s: DataCoverageDomain["status"]) =>
  s === "green" ? "bg-green-500" : s === "yellow" ? "bg-yellow-500" : "bg-red-500";

const capClass = (cap: "high" | "medium" | "low") =>
  cap === "high"
    ? "border-green-500/40 text-green-600 dark:text-green-400"
    : cap === "medium"
    ? "border-yellow-500/40 text-yellow-600 dark:text-yellow-400"
    : "border-red-500/40 text-red-600 dark:text-red-400";

const verdictClass = (v: DocumentIntelligenceEntry["verdict"]) =>
  v === "strong"
    ? "border-green-500/40 text-green-600 dark:text-green-400"
    : v === "adequate"
    ? "border-yellow-500/40 text-yellow-600 dark:text-yellow-400"
    : "border-red-500/40 text-red-600 dark:text-red-400";

const StatusIcon = ({ status }: { status: DataCoverageDomain["status"] }) => {
  if (status === "green") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "yellow") return <MinusCircle className="h-3.5 w-3.5 text-yellow-500" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
};

const prioBadgeClass = (p: MissingArtifact extends never ? never : "critical" | "high" | "medium" | "low") =>
  p === "critical"
    ? "border-red-500/40 text-red-600 dark:text-red-400"
    : p === "high"
    ? "border-orange-500/40 text-orange-600 dark:text-orange-400"
    : p === "medium"
    ? "border-yellow-500/40 text-yellow-600 dark:text-yellow-400"
    : "border-border text-muted-foreground";

export default function DataCoverageCard({
  audit,
  documentIntelligence = [],
  missingArtifacts = [],
  missingArtifactsSummary,
}: {
  audit: DataCoverageAudit;
  documentIntelligence?: DocumentIntelligenceEntry[];
  missingArtifacts?: MissingArtifactsRecommendation[];
  missingArtifactsSummary?: MissingArtifactsSummary;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const diByDomain = new Map(documentIntelligence.map((e) => [e.domain, e]));
  const summary = audit.document_review_summary;
  const domainLabelById = new Map(audit.domains.map((d) => [d.id, d.label]));
  const domainPrefillById = new Map(audit.domains.map((d) => [d.id, d.prefill_tag]));
  const sortedRecs = [...missingArtifacts].sort((a, b) => {
    const r: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (r[a.priority] ?? 9) - (r[b.priority] ?? 9);
  });


  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">What Duncan Can't See</h3>
          <p className="text-[11px] font-mono text-muted-foreground">
            {audit.counts.green}/{audit.counts.total} green · {audit.counts.yellow} partial · {audit.counts.red} missing
          </p>
          {summary && summary.documents_reviewed > 0 && (
            <p className="text-[11px] font-mono text-muted-foreground">
              Documents reviewed: {summary.documents_reviewed} · Weak: {summary.weak} · Adequate: {summary.adequate} · Strong: {summary.strong}
            </p>
          )}
        </div>
        <Badge variant="outline" className={`text-[10px] font-mono uppercase ${capClass(audit.confidence_cap)}`}>
          Confidence cap: {audit.confidence_cap}
        </Badge>
      </div>

      <div className="divide-y divide-border">
        {audit.domains.map((d) => {
          const isOpen = expanded === d.id;
          const di = diByDomain.get(d.id);
          return (
            <div key={d.id} className="px-4 py-2.5">
              <button
                onClick={() => setExpanded(isOpen ? null : d.id)}
                className="w-full flex items-center gap-3 text-left"
              >
                <span className={`h-2 w-2 rounded-full ${dotClass(d.status)} shrink-0`} />
                <span className="text-sm text-foreground font-medium flex-1 truncate">{d.label}</span>
                {di && (
                  <Badge variant="outline" className={`text-[9px] font-mono uppercase ${verdictClass(di.verdict)}`}>
                    doc: {di.verdict}
                  </Badge>
                )}
                {d.critical && (
                  <Badge variant="outline" className="text-[9px] font-mono uppercase border-border text-muted-foreground">
                    critical
                  </Badge>
                )}
                <StatusIcon status={d.status} />
              </button>

              {isOpen && (
                <div className="mt-2 ml-5 space-y-3">
                  <p className="text-xs text-muted-foreground">{d.evidence}</p>

                  {di && (
                    <div className="rounded border border-border bg-muted/20 p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] font-mono text-foreground/80 truncate">{di.file_name}</span>
                      </div>
                      {di.what_it_covers && (
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-mono uppercase text-[9px] text-foreground/60">Covers:</span> {di.what_it_covers}
                        </p>
                      )}
                      {di.what_is_missing_in_doc && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          <span className="font-mono uppercase text-[9px]">Missing in doc:</span> {di.what_is_missing_in_doc}
                        </p>
                      )}
                      {Array.isArray(di.contradicted_by) && di.contradicted_by.length > 0 && (
                        <div className="text-[11px] text-red-600 dark:text-red-400">
                          <span className="font-mono uppercase text-[9px]">Contradicted by:</span>
                          <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
                            {di.contradicted_by.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(di.reinforced_by) && di.reinforced_by.length > 0 && (
                        <div className="text-[11px] text-green-600 dark:text-green-400">
                          <span className="font-mono uppercase text-[9px]">Reinforced by:</span>
                          <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
                            {di.reinforced_by.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(di.critical_gaps_to_fix) && di.critical_gaps_to_fix.length > 0 && (
                        <div className="text-[11px] text-foreground/80">
                          <span className="font-mono uppercase text-[9px] text-foreground/60">Fix next:</span>
                          <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
                            {di.critical_gaps_to_fix.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {d.recommendation && (
                    <>
                      <p className="text-xs text-foreground/80">{d.recommendation}</p>
                      <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                        <Link to={`/projects?prefill_tag=${encodeURIComponent(d.prefill_tag)}`}>
                          <Upload className="h-3 w-3 mr-1.5" />
                          Upload to fix
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {audit.confidence_cap !== "high" && (
        <div className="px-4 py-2.5 border-t border-border bg-muted/20">
          <p className="text-[11px] text-muted-foreground italic">{audit.cap_reason}</p>
        </div>
      )}

      {sortedRecs.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Files Duncan is asking for</h4>
            </div>
            {missingArtifactsSummary && (
              <p className="text-[11px] font-mono text-muted-foreground">
                {missingArtifactsSummary.total} files would unlock board-grade advice ·{" "}
                <span className="text-red-600 dark:text-red-400">{missingArtifactsSummary.critical} critical</span> ·{" "}
                <span className="text-orange-600 dark:text-orange-400">{missingArtifactsSummary.high} high</span> ·{" "}
                <span className="text-yellow-600 dark:text-yellow-400">{missingArtifactsSummary.medium} medium</span>
              </p>
            )}
          </div>
          <div className="divide-y divide-border">
            {sortedRecs.map((rec, gi) => (
              <div key={gi} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[9px] font-mono uppercase ${prioBadgeClass(rec.priority)}`}>
                    {rec.priority}
                  </Badge>
                  <span className="text-[11px] font-mono uppercase text-muted-foreground">
                    {domainLabelById.get(rec.domain) || rec.domain}
                  </span>
                </div>
                <div className="space-y-2 ml-1">
                  {rec.artifacts.map((a, ai) => {
                    const tag = domainPrefillById.get(rec.domain) || rec.domain;
                    const href = `/projects?prefill_tag=${encodeURIComponent(tag)}${a.suggested_filename_pattern ? `&suggested_name=${encodeURIComponent(a.suggested_filename_pattern)}` : ""}`;
                    return (
                      <div key={ai} className="rounded border border-border bg-muted/20 p-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-foreground">{a.name}</p>
                          <Button asChild size="sm" variant="outline" className="h-6 text-[10px] shrink-0">
                            <Link to={href}>
                              <Upload className="h-3 w-3 mr-1" />
                              Upload
                            </Link>
                          </Button>
                        </div>
                        {a.why_duncan_needs_it && (
                          <p className="text-[11px] text-muted-foreground">{a.why_duncan_needs_it}</p>
                        )}
                        {a.what_it_unlocks && (
                          <p className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                            <Zap className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                            <span><span className="font-mono uppercase text-[9px] text-foreground/60">Unlocks: </span>{a.what_it_unlocks}</span>
                          </p>
                        )}
                        {a.where_to_find_it && (
                          <p className="text-[11px] italic text-muted-foreground flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{a.where_to_find_it}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
