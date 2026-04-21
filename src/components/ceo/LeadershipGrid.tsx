import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, EyeOff, Activity, MessageSquare, Kanban, GitBranch, Rocket } from "lucide-react";

export type SignalStatus = "active" | "low_signal" | "silent";

export interface LeaderAssessment {
  name: string;
  role?: string;
  output_vs_expectation?: string;
  risk_level?: "low" | "medium" | "high";
  blocking?: string;
  needs_support?: string;
  ceo_intervention_required?: boolean;
  signal_status?: SignalStatus;
  evidence_sources?: string[];
}

const riskStyle = (r?: string) => {
  switch (r) {
    case "high": return "bg-red-500/15 text-red-500 border-red-500/40";
    case "medium": return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
    case "low": return "bg-green-500/15 text-green-500 border-green-500/40";
    default: return "bg-muted text-muted-foreground";
  }
};

const sourceIcon = (src: string) => {
  switch (src) {
    case "meetings": return <MessageSquare className="h-3 w-3" />;
    case "workstreams": return <Kanban className="h-3 w-3" />;
    case "azure": return <GitBranch className="h-3 w-3" />;
    case "releases": return <Rocket className="h-3 w-3" />;
    default: return <Activity className="h-3 w-3" />;
  }
};

const LeadershipGrid = ({ leaders }: { leaders: LeaderAssessment[] }) => {
  if (!leaders?.length) return null;

  const summary = {
    total: leaders.length,
    silent: leaders.filter((l) => l.signal_status === "silent").length,
    low: leaders.filter((l) => l.signal_status === "low_signal").length,
    intervention: leaders.filter((l) => l.ceo_intervention_required).length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
        <span>{summary.total} leaders</span>
        {summary.intervention > 0 && (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/40 text-[10px]">
            {summary.intervention} need CEO intervention
          </Badge>
        )}
        {summary.silent > 0 && (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-dashed text-[10px]">
            {summary.silent} silent
          </Badge>
        )}
        {summary.low > 0 && (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/40 text-[10px]">
            {summary.low} low signal
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {leaders.map((l, i) => {
          const silent = l.signal_status === "silent";
          const lowSignal = l.signal_status === "low_signal";
          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-4 space-y-2",
                silent && "border-dashed border-muted-foreground/40 bg-muted/30",
                lowSignal && !silent && "border-yellow-500/30 bg-yellow-500/5",
                !silent && !lowSignal && (l.ceo_intervention_required ? "border-red-500/40 bg-card" : "border-border bg-card"),
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground truncate">{l.name}</h4>
                    {silent && <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </div>
                  {l.role && (
                    <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">{l.role}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {silent ? (
                    <Badge variant="outline" className="uppercase text-[10px] bg-muted text-muted-foreground border-dashed">
                      No signal · 7d
                    </Badge>
                  ) : (
                    l.risk_level && (
                      <Badge variant="outline" className={cn("uppercase text-[10px]", riskStyle(l.risk_level))}>
                        {l.risk_level} risk
                      </Badge>
                    )
                  )}
                  {l.ceo_intervention_required && (
                    <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/40">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      CEO intervention
                    </Badge>
                  )}
                </div>
              </div>

              {/* Evidence-source chips */}
              {l.evidence_sources && l.evidence_sources.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {l.evidence_sources.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border uppercase"
                    >
                      {sourceIcon(s)} {s}
                    </span>
                  ))}
                </div>
              )}

              {l.output_vs_expectation && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">Output:</span> {l.output_vs_expectation}
                </p>
              )}
              {l.blocking && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">Blocking:</span> {l.blocking}
                </p>
              )}
              {l.needs_support && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">Support:</span> {l.needs_support}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeadershipGrid;
