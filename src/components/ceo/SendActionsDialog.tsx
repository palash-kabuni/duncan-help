import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, AlertTriangle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ActionItem {
  source: "coverage_gap" | "risk" | "workstream";
  severity: "red" | "yellow" | "info";
  title: string;
  why?: string;
  recommendation?: string;
}
interface OwnerBundle {
  owner_key: string;
  display_name: string;
  email: string | null;
  items: ActionItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  briefingId: string | null;
  briefingDate?: string;
  onSent?: () => void;
}

const sevDot = (s: string) => (s === "red" ? "🔴" : s === "yellow" ? "🟡" : "•");

const SendActionsDialog = ({ open, onOpenChange, briefingId, briefingDate, onSent }: Props) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [bundles, setBundles] = useState<OwnerBundle[]>([]);
  const [unrouted, setUnrouted] = useState<OwnerBundle[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");

  const dateLabel = briefingDate
    ? new Date(briefingDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  useEffect(() => {
    if (!open || !briefingId) return;
    setLoading(true);
    setBundles([]);
    setUnrouted([]);
    supabase.functions
      .invoke("send-ceo-briefing-actions", { body: { briefing_id: briefingId, dry_run: true } })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Preview failed", description: error.message, variant: "destructive" });
          return;
        }
        const b: OwnerBundle[] = (data?.bundles || []).filter((x: OwnerBundle) => x.items.length > 0);
        const u: OwnerBundle[] = (data?.unrouted || []).filter((x: OwnerBundle) => x.items.length > 0);
        setBundles(b);
        setUnrouted(u);
        setSelected(new Set(b.filter((x) => x.email).map((x) => x.owner_key)));
        setSubject(`[Duncan · CEO Brief] Your actions — ${dateLabel}`);
        setIntro(`Nimesh reviewed today's CEO Briefing (${dateLabel}). The items below need you this week.`);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, briefingId]);

  const toggle = (k: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const totalActions = useMemo(
    () => bundles.filter((b) => selected.has(b.owner_key)).reduce((s, b) => s + b.items.length, 0),
    [bundles, selected],
  );

  const handleSend = async () => {
    if (!briefingId || selected.size === 0) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-ceo-briefing-actions", {
      body: {
        briefing_id: briefingId,
        recipients: [...selected],
        subject,
        intro,
      },
    });
    setSending(false);
    if (error) {
      toast({ title: "Send failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: `Sent ${data?.sent ?? 0} email${data?.sent === 1 ? "" : "s"}`,
      description: data?.failed ? `${data.failed} failed.` : undefined,
    });
    onSent?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Send team actions
          </DialogTitle>
          <DialogDescription>
            Each leader receives only the items that are theirs to action. Review before sending.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Intro line</label>
                <Textarea rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />
              </div>
            </div>

            {bundles.length === 0 && unrouted.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No actionable items found in this briefing.
              </div>
            ) : (
              <div className="space-y-2">
                {bundles.map((b) => {
                  const isSelected = selected.has(b.owner_key);
                  const noEmail = !b.email;
                  return (
                    <div
                      key={b.owner_key}
                      className={`rounded-lg border p-3 ${isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          disabled={noEmail}
                          onCheckedChange={() => toggle(b.owner_key)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">{b.display_name}</span>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {b.items.length} action{b.items.length === 1 ? "" : "s"}
                              </Badge>
                            </div>
                            <span className={`text-xs ${noEmail ? "text-destructive" : "text-muted-foreground"}`}>
                              {b.email || "no email — set in Routing"}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {b.items.map((it, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                <span>{sevDot(it.severity)}</span>
                                <span className="text-foreground">{it.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {unrouted.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3">
                    <div className="flex items-center gap-2 text-yellow-600 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4" /> Unrouted actions
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      These items have no recognised owner. Add the owner's name to the briefing or update the routing table.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {unrouted.flatMap((b) => b.items).map((it, i) => (
                        <li key={i} className="text-xs text-foreground flex gap-2">
                          <span>{sevDot(it.severity)}</span>
                          <span>{it.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || loading || selected.size === 0}>
            <Send className="h-3.5 w-3.5 mr-2" />
            {sending ? "Sending…" : `Send ${selected.size} email${selected.size === 1 ? "" : "s"} · ${totalActions} actions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendActionsDialog;
