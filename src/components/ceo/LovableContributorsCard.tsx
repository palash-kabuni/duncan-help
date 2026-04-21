import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface SnapshotRow {
  member_name: string;
  role: string | null;
  period_credits: number;
  period_label: string | null;
  total_credits: number;
  credit_limit: number | null;
}

const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString() : "—";

const LovableContributorsCard = () => {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Find latest snapshot_date
      const { data: latest } = await supabase
        .from("lovable_usage_snapshots")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1);
      const date = latest?.[0]?.snapshot_date as string | undefined;
      if (!date) {
        if (!cancelled) {
          setSnapshotDate(null);
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const { data: all } = await supabase
        .from("lovable_usage_snapshots")
        .select("member_name, role, period_credits, period_label, total_credits, credit_limit")
        .eq("snapshot_date", date)
        .order("period_credits", { ascending: false });
      if (!cancelled) {
        setSnapshotDate(date);
        setRows((all || []) as SnapshotRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const periodLabel = rows.find((r) => r.period_label)?.period_label || "Period usage";
  const dateLabel = snapshotDate
    ? new Date(snapshotDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Lovable contributors
        </h3>
        {dateLabel && (
          <span className="text-[10px] font-mono text-muted-foreground">
            As of {dateLabel} · parsed from Lovable People page in chat
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          No Lovable usage snapshot yet. Paste the Lovable → Project settings → People screenshot in chat
          and ask Duncan to refresh Lovable contributors.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono tabular-nums">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left py-1.5 pr-3 w-8">#</th>
                <th className="text-left py-1.5 pr-3">Name</th>
                <th className="text-left py-1.5 pr-3">Role</th>
                <th className="text-right py-1.5 pr-3">{periodLabel}</th>
                <th className="text-right py-1.5">Total usage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.member_name}-${i}`} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-3 text-foreground">{r.member_name}</td>
                  <td className="py-1.5 pr-3">
                    {r.role ? (
                      <Badge variant="outline" className="text-[10px] font-mono">{r.role}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-foreground">{fmt(r.period_credits)}</td>
                  <td className="py-1.5 text-right text-foreground">{fmt(r.total_credits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LovableContributorsCard;
