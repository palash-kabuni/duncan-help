import { AlertTriangle, ShieldCheck, Plus, Activity, CircleOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface CoverageGap {
  priority_id?: string;
  priority: string;
  why_it_matters?: string;
  consequence_if_unowned?: string;
  recommended_owner?: string;
  recommended_workstream_name?: string;
  current_signal?: string | null;
  signal_sources?: string[];
  signal_status?: "active_but_untracked" | "silent";
  recommended_action?: string;
}

interface CoverageSummary {
  covered: number;
  total: number;
  ratio: number;
  covered_priorities?: { priority: string; matched_workstream: string | null }[];
  missing_priorities?: string[];
}

interface Props {
  gaps?: CoverageGap[];
  totalPriorities?: number;
  summary?: CoverageSummary;
}

const CoverageGaps = ({ gaps, totalPriorities = 6, summary }: Props) => {
  const list = Array.isArray(gaps) ? gaps : [];
  const total = summary?.total ?? totalPriorities;
  const covered = summary?.covered ?? (total - list.length);
  const ratioPct = Math.round(((summary?.ratio ?? covered / total) * 100));
  const fullyCovered = covered === total && list.length === 0;

  if (fullyCovered) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <p className="text-xs font-medium text-foreground">
          All {total} 2026 priorities have an active workstream.
        </p>
      </div>
    );
  }

  if (list.length === 0) {
    // Defensive: no gaps array but not fully covered — show neutral state.
    return null;
  }

  return (
    <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-semibold text-foreground">
          Coverage Gaps — {list.length} of {total} priorities have NO workstream ({ratioPct}% covered)
        </h3>
      </div>

      <div className="space-y-3">
        {list.map((g, i) => {
          const tag = g.recommended_workstream_name || g.priority.split("—")[0].trim();
          const href = `/workstreams?prefill_tag=${encodeURIComponent(tag)}${g.priority_id ? `&prefill_priority=${encodeURIComponent(g.priority_id)}` : ""}`;
          return (
            <div
              key={i}
              className="rounded-md border border-destructive/20 bg-card p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground leading-snug">
                  {g.priority}
                </h4>
                <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5 h-7 text-xs">
                  <Link to={href}>
                    <Plus className="h-3 w-3" /> Create workstream
                  </Link>
                </Button>
              </div>
              {g.why_it_matters && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono uppercase text-[10px] tracking-wider text-muted-foreground/80">Why:</span>{" "}
                  {g.why_it_matters}
                </p>
              )}
              {g.consequence_if_unowned && (
                <p className="text-xs text-destructive/90">
                  <span className="font-mono uppercase text-[10px] tracking-wider">If unowned:</span>{" "}
                  {g.consequence_if_unowned}
                </p>
              )}
              {g.recommended_owner && (
                <p className="text-[11px] font-mono text-muted-foreground">
                  Suggested owner: <span className="text-foreground">{g.recommended_owner}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CoverageGaps;
