import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ScoreGauge from "./ScoreGauge";

interface PulseBannerProps {
  trajectory?: string;
  outcomeProbability?: number;
  probabilityDelta?: number | null;
  executionScore?: number;
  executionDelta?: number | null;
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

const PulseBanner = ({ trajectory, outcomeProbability = 0, probabilityDelta, executionScore = 0, executionDelta }: PulseBannerProps) => (
  <div className="flex flex-col md:flex-row items-stretch gap-6 rounded-lg border border-border bg-card p-6">
    <div className="flex-1 flex flex-col justify-center gap-3">
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Trajectory</span>
      <Badge variant="outline" className={cn("w-fit text-base px-4 py-1.5 font-semibold", trajectoryStyle(trajectory))}>
        {trajectory || "—"}
      </Badge>
      <p className="text-sm text-muted-foreground">June 7 India Lightning Strike readiness</p>
    </div>
    <div className="flex items-center justify-around gap-6 md:border-l md:border-border md:pl-6">
      <ScoreGauge label="Probability %" score={outcomeProbability} delta={probabilityDelta} size="lg" />
      <ScoreGauge label="Execution" score={executionScore} delta={executionDelta} size="lg" />
    </div>
  </div>
);

export default PulseBanner;
