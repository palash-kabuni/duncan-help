import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Risk {
  risk: string;
  why_it_matters?: string;
  impact_7d?: string;
  impact_30d?: string;
  impact_90d?: string;
  owner?: string;
  severity?: "low" | "medium" | "high" | "critical";
  confidence?: number;
}

const sevStyle = (s?: string) => {
  switch (s) {
    case "critical": return "bg-red-500/15 text-red-500 border-red-500/40";
    case "high": return "bg-orange-500/15 text-orange-500 border-orange-500/40";
    case "medium": return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
    default: return "bg-muted text-muted-foreground";
  }
};

const RiskRadar = ({ risks }: { risks: Risk[] }) => (
  <div className="space-y-3">
    {risks.map((r, i) => (
      <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0",
              r.severity === "critical" || r.severity === "high" ? "text-red-500" : "text-yellow-500"
            )} />
            <h4 className="text-sm font-semibold text-foreground">{r.risk}</h4>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {r.severity && <Badge variant="outline" className={cn("uppercase text-[10px]", sevStyle(r.severity))}>{r.severity}</Badge>}
            {typeof r.confidence === "number" && (
              <span className="text-[10px] font-mono text-muted-foreground">conf {r.confidence}%</span>
            )}
          </div>
        </div>
        {r.why_it_matters && <p className="text-xs text-muted-foreground">{r.why_it_matters}</p>}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><span className="font-mono text-muted-foreground">7d:</span> <span className="text-foreground">{r.impact_7d || "—"}</span></div>
          <div><span className="font-mono text-muted-foreground">30d:</span> <span className="text-foreground">{r.impact_30d || "—"}</span></div>
          <div><span className="font-mono text-muted-foreground">90d:</span> <span className="text-foreground">{r.impact_90d || "—"}</span></div>
        </div>
        {r.owner && <p className="text-[11px] font-mono text-muted-foreground">Owner: <span className="text-foreground">{r.owner}</span></p>}
      </div>
    ))}
  </div>
);

export default RiskRadar;
