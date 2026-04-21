import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, AlertTriangle, CheckCircle2, MinusCircle, FileText } from "lucide-react";
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
};

export type DataCoverageAudit = {
  domains: DataCoverageDomain[];
  counts: { red: number; yellow: number; green: number; total: number };
  confidence_cap: "high" | "medium" | "low";
  cap_reason: string;
  worst_red_domain: { id: string; label: string; recommendation: string | null } | null;
  critical_reds: Array<{ id: string; label: string; recommendation: string | null }>;
  document_review_summary?: { documents_reviewed: number; weak: number; adequate: number; strong: number };
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

export default function DataCoverageCard({
  audit,
  documentIntelligence = [],
}: {
  audit: DataCoverageAudit;
  documentIntelligence?: DocumentIntelligenceEntry[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const diByDomain = new Map(documentIntelligence.map((e) => [e.domain, e]));
  const summary = audit.document_review_summary;

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
    </div>
  );
}
