import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImpactWindow {
  window?: string;
  impact?: string;
  mitigation?: string;
}

export interface Risk {
  risk: string;
  why_it_matters?: string;
  impact_7d?: ImpactWindow | string;
  impact_30d?: ImpactWindow | string;
  impact_90d?: ImpactWindow | string;
  owner?: string;
  severity?: "low" | "medium" | "high" | "critical";
  confidence?: number;
  probability_impact_pts?: number;
  auto_injected?: boolean;
  auto_injected_reason?: string;
  auto_upgraded?: boolean;
}

export interface RiskReconciliation {
  outcome_probability?: number;
  execution_score?: number;
  probability_gap?: number;
  accounted_for_pts?: number;
  unexplained_pts?: number;
  auto_injected_count?: number;
  warning?: string | null;
}

const sevStyle = (s?: string) => {
  switch (s) {
    case "critical": return "bg-red-500/15 text-red-500 border-red-500/40";
    case "high": return "bg-orange-500/15 text-orange-500 border-orange-500/40";
    case "medium": return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
    default: return "bg-muted text-muted-foreground";
  }
};

const ImpactCell = ({ label, w }: { label: string; w?: ImpactWindow | string }) => {
  if (!w) return (
    <div className="rounded border border-border/60 p-2 space-y-1">
      <p className="text-[10px] font-mono uppercase text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">—</p>
    </div>
  );
  if (typeof w === "string") {
    return (
      <div className="rounded border border-border/60 p-2 space-y-1">
        <p className="text-[10px] font-mono uppercase text-muted-foreground">{label}</p>
        <p className="text-xs text-foreground">{w}</p>
      </div>
    );
  }
  return (
    <div className="rounded border border-border/60 p-2 space-y-1">
      <p className="text-[10px] font-mono uppercase text-muted-foreground">{label}</p>
      <p className="text-xs text-foreground leading-snug">{w.impact || "—"}</p>
      {w.mitigation && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          <span className="font-mono text-primary/80">→</span> {w.mitigation}
        </p>
      )}
    </div>
  );
};

const RiskRadar = ({
  risks,
  reconciliation,
}: {
  risks: Risk[];
  reconciliation?: RiskReconciliation | null;
}) => {
  // Sort defensively in case backend didn't.
  const sorted = [...risks].sort(
    (a, b) => (b.probability_impact_pts || 0) - (a.probability_impact_pts || 0)
  );

  return (
    <div className="space-y-3">
      {reconciliation && typeof reconciliation.probability_gap === "number" && (
        <div className={cn(
          "rounded-lg border bg-card p-3 space-y-1",
          reconciliation.warning ? "border-amber-500/40" : "border-border"
        )}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">
              Probability <span className="text-foreground font-semibold">{reconciliation.outcome_probability ?? "—"}%</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              Execution <span className="text-foreground font-semibold">{reconciliation.execution_score ?? "—"}/100</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              Risks below account for <span className="text-foreground font-semibold">{reconciliation.accounted_for_pts ?? 0}</span> of {reconciliation.probability_gap} lost probability points
            </span>
          </div>
          {reconciliation.warning && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              {reconciliation.warning}
            </p>
          )}
        </div>
      )}

      {sorted.map((r, i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg bg-card p-4 space-y-3",
            r.auto_injected ? "border border-dashed border-amber-500/50" : "border border-border"
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0",
              r.severity === "critical" || r.severity === "high" ? "text-red-500" : "text-yellow-500"
            )} />
            <div className="flex-1 min-w-0 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
              <h4 className="text-sm font-semibold text-foreground break-words min-w-0 lg:flex-1">{r.risk}</h4>
              <div className="flex items-center gap-1.5 flex-wrap lg:shrink-0 lg:justify-end">
                {typeof r.probability_impact_pts === "number" && r.probability_impact_pts > 0 && (
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary whitespace-nowrap">
                    −{r.probability_impact_pts} pts
                  </Badge>
                )}
                {r.severity && <Badge variant="outline" className={cn("uppercase text-[10px] whitespace-nowrap", sevStyle(r.severity))}>{r.severity}</Badge>}
                {typeof r.confidence === "number" && (
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">conf {r.confidence}%</span>
                )}
              </div>
            </div>
          </div>
          {(r.auto_injected || r.auto_upgraded) && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              {r.auto_injected ? "Auto-flagged from headline" : "Severity auto-upgraded"}
              {r.auto_injected_reason && (
                <span className="text-muted-foreground normal-case">· {r.auto_injected_reason.replace(/_/g, " ")}</span>
              )}
            </div>
          )}
          {r.why_it_matters && <p className="text-xs text-muted-foreground">{r.why_it_matters}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <ImpactCell label="7 days" w={r.impact_7d} />
            <ImpactCell label="30 days" w={r.impact_30d} />
            <ImpactCell label="90 days" w={r.impact_90d} />
          </div>
          {r.owner && <p className="text-[11px] font-mono text-muted-foreground">Owner: <span className="text-foreground">{r.owner}</span></p>}
        </div>
      ))}
    </div>
  );
};

export default RiskRadar;
