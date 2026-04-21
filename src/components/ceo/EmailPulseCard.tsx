import { Mail, AlertTriangle, MessageSquareWarning, Inbox } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface EmailPulseSummary {
  window_hours?: number;
  mailboxes_eligible?: number;
  mailboxes_total?: number;
  mailboxes_skipped_optout?: number;
  emails_analysed?: number;
  per_mailbox?: Array<{
    mailbox: string;
    status: string;
    emails_scanned: number;
    sent_count: number;
    commitments: number;
    risks: number;
  }>;
  counts?: {
    commitments: number;
    risks: number;
    critical_risks: number;
    escalations: number;
    board_mentions: number;
    customer_issues: number;
    vendor_signals: number;
    unowned_commitments: number;
  };
  silent_leaders?: Array<{ leader: string; reason: string }>;
}

interface Props {
  pulse: EmailPulseSummary | null | undefined;
}

export default function EmailPulseCard({ pulse }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!pulse || !pulse.per_mailbox) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Inbox className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground">
            No email pulse data in this briefing — no leaders have opted in to inbox scanning yet, or
            the email pulse step did not run.
          </div>
        </div>
      </div>
    );
  }

  const c = pulse.counts || {
    commitments: 0,
    risks: 0,
    critical_risks: 0,
    escalations: 0,
    board_mentions: 0,
    customer_issues: 0,
    vendor_signals: 0,
    unowned_commitments: 0,
  };

  const eligible = pulse.mailboxes_eligible ?? 0;
  const total = pulse.mailboxes_total ?? 0;
  const optedOut = pulse.mailboxes_skipped_optout ?? Math.max(0, total - eligible);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Company Email Pulse — last {pulse.window_hours ?? 24}h
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          {pulse.emails_analysed ?? 0} emails
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mailboxes</div>
          <div className="text-foreground tabular-nums mt-0.5">
            {eligible} of {total}
            {optedOut > 0 && <span className="text-muted-foreground"> ({optedOut} opted out)</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Commitments</div>
          <div className="text-foreground tabular-nums mt-0.5">
            {c.commitments}
            {c.unowned_commitments > 0 && (
              <span className="text-amber-600 dark:text-amber-400"> · {c.unowned_commitments} unowned</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risks raised</div>
          <div className="text-foreground tabular-nums mt-0.5">
            {c.risks}
            {c.critical_risks > 0 && (
              <span className="text-red-600 dark:text-red-400"> · {c.critical_risks} critical</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Board / customers</div>
          <div className="text-foreground tabular-nums mt-0.5">
            {c.board_mentions} / {c.customer_issues}
          </div>
        </div>
      </div>

      {pulse.silent_leaders && pulse.silent_leaders.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2.5">
          <div className="flex items-start gap-2">
            <MessageSquareWarning className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-[11px] font-mono uppercase text-amber-600 dark:text-amber-400">
                Silent leaders
              </div>
              <div className="text-xs text-foreground mt-1 leading-relaxed">
                {pulse.silent_leaders.map((s, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <span className="font-medium">{s.leader}</span>
                    <span className="text-muted-foreground"> ({s.reason})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {pulse.per_mailbox.length > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide" : "View"} per-mailbox breakdown
          </Button>
          {expanded && (
            <div className="mt-2 rounded border border-border overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Mailbox</th>
                    <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Status</th>
                    <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Scanned</th>
                    <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Sent</th>
                    <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Commits</th>
                    <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Risks</th>
                  </tr>
                </thead>
                <tbody>
                  {pulse.per_mailbox.map((m, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5 text-foreground">{m.mailbox || "—"}</td>
                      <td className="px-2 py-1.5">
                        {m.status === "ok" ? (
                          <span className="text-green-600 dark:text-green-400">ok</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {m.status}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{m.emails_scanned}</td>
                      <td className="px-2 py-1.5 tabular-nums">{m.sent_count}</td>
                      <td className="px-2 py-1.5 tabular-nums">{m.commitments}</td>
                      <td className="px-2 py-1.5 tabular-nums">{m.risks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Privacy: only opted-in mailboxes are scanned. Email content is sent to OpenAI for one-time
        extraction; only the structured signals above are persisted on this briefing.
      </p>
    </div>
  );
}
