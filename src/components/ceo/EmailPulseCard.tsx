import { Mail, AlertTriangle, MessageSquareWarning, Inbox, MailX, MailMinus, Info } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type LeaderState = "silent" | "opted_out" | "not_connected" | "active" | "error";

export interface LeadershipStatusEntry {
  leader: string;
  email: string;
  state: LeaderState;
  reason: string;
}

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
  leadership_status?: LeadershipStatusEntry[];
  opted_out_mailboxes?: Array<{ email: string | null; display_name: string | null }>;
}

interface Props {
  pulse: EmailPulseSummary | null | undefined;
}

function MetricLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1 cursor-help">
          {label}
          <Info className="h-2.5 w-2.5 opacity-60" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function LeadershipGroup({
  title,
  tone,
  hint,
  entries,
}: {
  title: string;
  tone: "amber" | "muted";
  hint?: string;
  entries: LeadershipStatusEntry[];
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  if (entries.length === 0) return null;

  const wrapperClass =
    tone === "amber"
      ? "rounded border border-amber-500/40 bg-amber-500/5 p-2.5"
      : "rounded border border-border bg-muted/30 p-2.5";
  const labelClass =
    tone === "amber"
      ? "text-[11px] font-mono uppercase text-amber-600 dark:text-amber-400"
      : "text-[11px] font-mono uppercase text-muted-foreground";
  const Icon = tone === "amber" ? MessageSquareWarning : MailMinus;
  const iconClass =
    tone === "amber"
      ? "h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
      : "h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5";

  return (
    <div className={wrapperClass}>
      <div className="flex items-start gap-2">
        <Icon className={iconClass} />
        <div className="flex-1 min-w-0">
          <div className={labelClass}>
            {title} ({entries.length}){hint ? <span className="ml-1 normal-case text-muted-foreground">· {hint}</span> : null}
          </div>
          <div className="mt-1.5 space-y-1">
            {entries.map((e, i) => (
              <button
                key={`${e.leader}-${i}`}
                type="button"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="w-full text-left text-xs leading-tight hover:bg-background/50 rounded px-1 py-0.5 transition-colors"
              >
                <span className="font-medium text-foreground">{e.leader}</span>
                {e.email && (
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                    {e.email}
                  </span>
                )}
                {expandedIdx === i && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground italic">
                    {e.reason}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailPulseCard({ pulse }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showOptedOut, setShowOptedOut] = useState(false);

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

  const status = pulse.leadership_status || [];
  const silent = status.filter((s) => s.state === "silent");
  const optedOutLeaders = status.filter((s) => s.state === "opted_out");
  const notConnected = status.filter((s) => s.state === "not_connected");
  const errored = status.filter((s) => s.state === "error");

  // Backwards-compat: if no leadership_status, fall back to old silent_leaders
  const legacySilent =
    status.length === 0 && pulse.silent_leaders
      ? pulse.silent_leaders.map<LeadershipStatusEntry>((s) => ({
          leader: s.leader,
          email: "",
          state: "silent",
          reason: s.reason,
        }))
      : [];

  return (
    <TooltipProvider delayDuration={150}>
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
            <MetricLabel
              label="Mailboxes"
              tooltip="Connected Gmail accounts that are opted in to the pulse vs total connected. Opt-out is controlled per user in Settings → Gmail."
            />
            <div className="text-foreground tabular-nums mt-0.5">
              {eligible} of {total}
              {optedOut > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOptedOut((v) => !v)}
                  className="ml-1 text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                >
                  ({optedOut} opted out)
                </button>
              )}
            </div>
            {showOptedOut && optedOut > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {(pulse.opted_out_mailboxes && pulse.opted_out_mailboxes.length > 0) ? (
                  pulse.opted_out_mailboxes.map((m, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground leading-tight">
                      {m.display_name && <span className="text-foreground">{m.display_name}</span>}
                      {m.display_name && m.email && <span> · </span>}
                      {m.email && <span className="font-mono">{m.email}</span>}
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-muted-foreground italic">
                    Names unavailable on this briefing.
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <MetricLabel
              label="Commitments"
              tooltip="Concrete promises an owner made in email in the last 24h (e.g. 'I'll send the deck by Friday'). 'Unowned' means no clear person took responsibility."
            />
            <div className="text-foreground tabular-nums mt-0.5">
              {c.commitments}
              {c.unowned_commitments > 0 && (
                <span className="text-amber-600 dark:text-amber-400"> · {c.unowned_commitments} unowned</span>
              )}
            </div>
          </div>
          <div>
            <MetricLabel
              label="Risks raised"
              tooltip="Material risks surfaced in email by the LLM (severity low/medium/high/critical), filtered to things touching a 2026 priority or finance/legal/customers. 'Critical' counts severity ≥ high."
            />
            <div className="text-foreground tabular-nums mt-0.5">
              {c.risks}
              {c.critical_risks > 0 && (
                <span className="text-red-600 dark:text-red-400"> · {c.critical_risks} critical</span>
              )}
            </div>
          </div>
          <div>
            <MetricLabel
              label="Board / Customers"
              tooltip="Board mentions (emails referencing investors, board members, or board materials) over customer issues (emails flagging a customer problem)."
            />
            <div className="text-foreground tabular-nums mt-0.5">
              {c.board_mentions} / {c.customer_issues}
            </div>
          </div>
        </div>

        {(silent.length > 0 || optedOutLeaders.length > 0 || notConnected.length > 0 || errored.length > 0 || legacySilent.length > 0) && (
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Leadership status
            </div>
            <LeadershipGroup
              title="Silent"
              tone="amber"
              hint="connected & opted in, 0 sent in 24h"
              entries={silent.length > 0 ? silent : legacySilent}
            />
            <LeadershipGroup
              title="Opted out"
              tone="muted"
              hint="connected, scan disabled by user"
              entries={optedOutLeaders}
            />
            <LeadershipGroup
              title="Not connected"
              tone="muted"
              hint="Gmail not connected to Duncan"
              entries={notConnected}
            />
            {errored.length > 0 && (
              <LeadershipGroup
                title="Mailbox error"
                tone="amber"
                hint="opted in but scan failed"
                entries={errored}
              />
            )}
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
    </TooltipProvider>
  );
}
