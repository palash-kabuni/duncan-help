import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  label: string;
  score: number;
  max?: number;
  delta?: number | null;
  size?: "sm" | "md" | "lg";
}

const colorFor = (pct: number) => {
  if (pct >= 75) return "text-green-500";
  if (pct >= 50) return "text-yellow-500";
  if (pct >= 25) return "text-orange-500";
  return "text-red-500";
};

const ScoreGauge = ({ label, score, max = 100, delta, size = "md" }: ScoreGaugeProps) => {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const color = colorFor(pct);
  const dim = size === "lg" ? "h-28 w-28" : size === "sm" ? "h-16 w-16" : "h-20 w-20";
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", dim)}>
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-muted" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9155" fill="none"
            className={cn("transition-all duration-500", color)}
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${pct}, 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold tabular-nums", text, color)}>{Math.round(score)}</span>
          {typeof delta === "number" && delta !== 0 && (
            <span className={cn("text-[10px] font-mono", delta > 0 ? "text-green-500" : "text-red-500")}>
              {delta > 0 ? "+" : ""}{delta.toFixed(0)}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
};

export default ScoreGauge;
