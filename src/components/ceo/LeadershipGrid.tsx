import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface LeaderAssessment {
  name: string;
  role?: string;
  output_vs_expectation?: string;
  risk_level?: "low" | "medium" | "high";
  blocking?: string;
  needs_support?: string;
  ceo_intervention_required?: boolean;
}

const riskStyle = (r?: string) => {
  switch (r) {
    case "high": return "bg-red-500/15 text-red-500 border-red-500/40";
    case "medium": return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
    case "low": return "bg-green-500/15 text-green-500 border-green-500/40";
    default: return "bg-muted text-muted-foreground";
  }
};

const LeadershipGrid = ({ leaders }: { leaders: LeaderAssessment[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {leaders.map((l, i) => (
      <div key={i} className={cn(
        "rounded-lg border bg-card p-4 space-y-2",
        l.ceo_intervention_required ? "border-red-500/40" : "border-border"
      )}>
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">{l.name}</h4>
            {l.role && <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">{l.role}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {l.risk_level && <Badge variant="outline" className={cn("uppercase text-[10px]", riskStyle(l.risk_level))}>{l.risk_level} risk</Badge>}
            {l.ceo_intervention_required && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/40">CEO intervention</Badge>}
          </div>
        </div>
        {l.output_vs_expectation && (
          <p className="text-xs text-muted-foreground"><span className="font-mono text-foreground">Output:</span> {l.output_vs_expectation}</p>
        )}
        {l.blocking && (
          <p className="text-xs text-muted-foreground"><span className="font-mono text-foreground">Blocking:</span> {l.blocking}</p>
        )}
        {l.needs_support && (
          <p className="text-xs text-muted-foreground"><span className="font-mono text-foreground">Support:</span> {l.needs_support}</p>
        )}
      </div>
    ))}
  </div>
);

export default LeadershipGrid;
