import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import { useState } from "react";

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
};

const dotClass = (s: DataCoverageDomain["status"]) =>
  s === "green" ? "bg-green-500" : s === "yellow" ? "bg-yellow-500" : "bg-red-500";

const capClass = (cap: "high" | "medium" | "low") =>
  cap === "high"
    ? "border-green-500/40 text-green-600 dark:text-green-400"
    : cap === "medium"
    ? "border-yellow-500/40 text-yellow-600 dark:text-yellow-400"
    : "border-red-500/40 text-red-600 dark:text-red-400";

const StatusIcon = ({ status }: { status: DataCoverageDomain["status"] }) => {
  if (status === "green") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "yellow") return <MinusCircle className="h-3.5 w-3.5 text-yellow-500" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
};

export default function DataCoverageCard({ audit }: { audit: DataCoverageAudit }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">What Duncan Can't See</h3>
          <p className="text-[11px] font-mono text-muted-foreground">
            {audit.counts.green}/{audit.counts.total} green · {audit.counts.yellow} partial · {audit.counts.red} missing
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] font-mono uppercase ${capClass(audit.confidence_cap)}`}>
          Confidence cap: {audit.confidence_cap}
        </Badge>
      </div>

      <div className="divide-y divide-border">
        {audit.domains.map((d) => {
          const isOpen = expanded === d.id;
          return (
            <div key={d.id} className="px-4 py-2.5">
              <button
                onClick={() => setExpanded(isOpen ? null : d.id)}
                className="w-full flex items-center gap-3 text-left"
              >
                <span className={`h-2 w-2 rounded-full ${dotClass(d.status)} shrink-0`} />
                <span className="text-sm text-foreground font-medium flex-1 truncate">{d.label}</span>
                {d.critical && (
                  <Badge variant="outline" className="text-[9px] font-mono uppercase border-border text-muted-foreground">
                    critical
                  </Badge>
                )}
                <StatusIcon status={d.status} />
              </button>

              {isOpen && (
                <div className="mt-2 ml-5 space-y-2">
                  <p className="text-xs text-muted-foreground">{d.evidence}</p>
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
