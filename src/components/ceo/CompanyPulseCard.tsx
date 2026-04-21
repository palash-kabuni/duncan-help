import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export interface CompanyPulseStatus {
  status: "red" | "yellow" | "green";
  label: string;
  reason: string;
  evidence?: string[];
  blockers?: string[];
  positive_signals?: string[];
  confidence?: "high" | "medium" | "low";
}

interface Props {
  pulse: CompanyPulseStatus;
}

const statusConfig = {
  red:    { icon: XCircle,        cls: "bg-red-500/10 text-red-500 border-red-500/40",          ring: "border-red-500/40" },
  yellow: { icon: AlertTriangle,  cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/40", ring: "border-yellow-500/40" },
  green:  { icon: CheckCircle2,   cls: "bg-green-500/10 text-green-500 border-green-500/40",    ring: "border-green-500/40" },
};

const CompanyPulseCard = ({ pulse }: Props) => {
  const cfg = statusConfig[pulse.status] ?? statusConfig.red;
  const Icon = cfg.icon;
  const label = (pulse.label || pulse.status || "Red").toUpperCase();

  return (
    <div className={cn("rounded-lg border-2 bg-card p-5 space-y-4", cfg.ring)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon className={cn("h-5 w-5", pulse.status === "red" ? "text-red-500" : pulse.status === "yellow" ? "text-yellow-500" : "text-green-500")} />
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Company Pulse</p>
            <Badge variant="outline" className={cn("mt-1 text-base px-3 py-1 font-bold", cfg.cls)}>
              {label}
            </Badge>
          </div>
        </div>
        {pulse.confidence && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            confidence: {pulse.confidence}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-foreground">{pulse.reason}</p>

      {pulse.evidence && pulse.evidence.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Evidence</p>
          <ul className="space-y-1">
            {pulse.evidence.map((e, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-muted-foreground/60">•</span><span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pulse.blockers && pulse.blockers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-red-500">Blockers</p>
          <ul className="space-y-1">
            {pulse.blockers.map((b, i) => (
              <li key={i} className="text-xs text-foreground flex gap-2">
                <span className="text-red-500">▸</span><span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pulse.positive_signals && pulse.positive_signals.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-green-500">Positive signals</p>
          <ul className="space-y-1">
            {pulse.positive_signals.map((p, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-green-500">▸</span><span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CompanyPulseCard;
