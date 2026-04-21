import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import ScoreGauge from "./ScoreGauge";

interface PulseBannerProps {
  trajectory?: string;
  outcomeProbability?: number;
  probabilityDelta?: number | null;
  executionScore?: number;
  executionDelta?: number | null;
  coverageRatio?: number | null;
  coverageCovered?: number | null;
  coverageTotal?: number | null;
  confidenceWarning?: string | null;
}

const trajectoryStyle = (t?: string) => {
  switch ((t || "").toLowerCase()) {
    case "on track": return "bg-green-500/10 text-green-500 border-green-500/30";
    case "slight drift": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    case "at risk": return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "off track": return "bg-red-500/10 text-red-500 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
};

const PulseBanner = ({
  trajectory,
  outcomeProbability = 0,
  probabilityDelta,
  executionScore = 0,
  executionDelta,
  coverageRatio,
  coverageCovered,
  coverageTotal,
  confidenceWarning,
}: PulseBannerProps) => {
  const lowEvidence = typeof coverageRatio === "number" && coverageRatio < 0.5;
  const covered = coverageCovered ?? 0;
  const total = coverageTotal ?? 6;

  return (
    <div className="space-y-3">
      {lowEvidence && (
        <div className="flex items-start gap-2 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              Low-evidence briefing — Duncan can only see {covered} of {total} 2026 priorities.
            </p>
            <p className="text-[11px] text-muted-foreground">
              {confidenceWarning || "Probability and execution scores are capped until missing workstreams are created."}
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row items-stretch gap-6 rounded-lg border border-border bg-card p-6">
        <div className="flex-1 flex flex-col justify-center gap-3">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">June 7 Trajectory</span>
          <Badge variant="outline" className={cn("w-fit text-base px-4 py-1.5 font-semibold", trajectoryStyle(trajectory))}>
            {trajectory || "—"}
          </Badge>
          <p className="text-sm text-muted-foreground">India Lightning Strike readiness only — overall company health shown in Company Pulse above.</p>
        </div>
        <div className={cn(
          "flex items-center justify-around gap-6 md:border-l md:border-border md:pl-6 transition-opacity",
          lowEvidence && "opacity-60"
        )}>
          <ScoreGauge label="Probability %" score={outcomeProbability} delta={probabilityDelta} size="lg" />
          <ScoreGauge label="Execution" score={executionScore} delta={executionDelta} size="lg" />
        </div>
      </div>
    </div>
  );
};

export default PulseBanner;
