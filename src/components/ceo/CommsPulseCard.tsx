import { Mail, Hash, AlertTriangle, MessageSquareWarning, Inbox, MailMinus, Info, Slack } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EmailPulseSummary, LeadershipStatusEntry } from "./EmailPulseCard";

export interface SlackPulseSummary {
  window_hours?: number;
  degraded?: boolean;
  degraded_reason?: string | null;
  channels_total?: number;
  channels_member?: number;
  channels_eligible?: number;
  channels_scanned?: number;
  messages_analysed?: number;
  per_channel?: Array<{
    channel: string;
    status: string;
    messages_scanned: number;
    commitments: number;
    escalations: number;
    confusion: number;
    customer_issues: number;
    risks: number;
  }>;
  silent_channels?: Array<{ channel: string; reason: string }>;
  not_member_channels?: Array<{ id: string; name: string; is_private?: boolean }>;
  counts?: {
    commitments: number;
    unowned_commitments: number;
    escalations: number;
    confusion: number;
    customer_issues: number;
    risks: number;
    critical_risks: number;
  };
}

interface Props {
  emailPulse: EmailPulseSummary | null | undefined;
  slackPulse: SlackPulseSummary | null | undefined;
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

function EmailColumn({ pulse }: { pulse: EmailPulseSummary | null | undefined }) {
  const [showOptedOut, setShowOptedOut] = useState(false);

  if (!pulse || !pulse.per_mailbox) {
    return (
      <div className="rounded border border-dashed border-border bg-muted/20 p-3">
        <div className="flex items-start gap-2">
          <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-[11px] font-mono uppercase text-muted-foreground">Email</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              No email pulse — no opted-in mailboxes, or the scan did not run.
            </div>
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
    <div className="rounded border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-foreground">Email</span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          {pulse.emails_analysed ?? 0} emails
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div>
          <MetricLabel
            label="Mailboxes"
            tooltip="Connected Gmail accounts opted in to the pulse vs total connected. Opt-out is per user in Settings → Gmail."
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
              {pulse.opted_out_mailboxes && pulse.opted_out_mailboxes.length > 0 ? (
                pulse.opted_out_mailboxes.map((m, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground leading-tight">
                    {m.display_name && <span className="text-foreground">{m.display_name}</span>}
                    {m.display_name && m.email && <span> · </span>}
                    {m.email && <span className="font-mono">{m.email}</span>}
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-muted-foreground italic">Names unavailable.</div>
              )}
            </div>
          )}
        </div>
        <div>
          <MetricLabel
            label="Commitments"
            tooltip="Concrete promises an owner made in email in the last 24h. 'Unowned' means no clear person took responsibility."
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
            tooltip="Material risks surfaced in email (severity ≥ medium counts toward critical), filtered to 2026 priorities or finance/legal/customers."
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
            tooltip="Board mentions (investor/board references) over customer issues (named customer problems)."
          />
          <div className="text-foreground tabular-nums mt-0.5">
            {c.board_mentions} / {c.customer_issues}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlackColumn({ pulse }: { pulse: SlackPulseSummary | null | undefined }) {
  const [showSilent, setShowSilent] = useState(false);
  const [showNotMember, setShowNotMember] = useState(false);

  if (!pulse) {
    return (
      <div className="rounded border border-dashed border-border bg-muted/20 p-3">
        <div className="flex items-start gap-2">
          <Slack className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-[11px] font-mono uppercase text-muted-foreground">Slack</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Slack pulse did not run on this briefing — connector unavailable or scan failed.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const c = pulse.counts || {
    commitments: 0,
    unowned_commitments: 0,
    escalations: 0,
    confusion: 0,
    customer_issues: 0,
    risks: 0,
    critical_risks: 0,
  };
  const scanned = pulse.channels_scanned ?? 0;
  const member = pulse.channels_member ?? 0;
  const total = pulse.channels_total ?? 0;
  const notMember = pulse.not_member_channels?.length ?? Math.max(0, total - member);
  const silent = pulse.silent_channels || [];
  const degraded = !!pulse.degraded;

  return (
    <div className="rounded border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Slack className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-foreground">Slack</span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          {pulse.messages_analysed ?? 0} msgs
        </Badge>
      </div>

      {degraded && (
        <div className="rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-400 leading-snug">
          Reduced coverage — public channels only.
          {pulse.degraded_reason ? <span className="block mt-0.5 text-muted-foreground">{pulse.degraded_reason}</span> : null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div>
          <MetricLabel
            label="Channels"
            tooltip="Duncan is in N of M channels. Only channels Duncan is a member of are scanned. Invite the bot to a channel to make it visible to the briefing."
          />
          <div className="text-foreground tabular-nums mt-0.5">
            Duncan in {member} of {total}
            {notMember > 0 && (
              <button
                type="button"
                onClick={() => setShowNotMember((v) => !v)}
                className="ml-1 text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
              >
                ({notMember} not invited)
              </button>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
            Scanned: {scanned}
          </div>
          {showNotMember && pulse.not_member_channels && pulse.not_member_channels.length > 0 && (
            <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
              {pulse.not_member_channels.slice(0, 20).map((ch, i) => (
                <div key={i} className="text-[10px] text-muted-foreground leading-tight font-mono">
                  #{ch.name}{ch.is_private ? " 🔒" : ""}
                </div>
              ))}
              {pulse.not_member_channels.length > 20 && (
                <div className="text-[10px] text-muted-foreground italic">
                  +{pulse.not_member_channels.length - 20} more
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <MetricLabel
            label="Commitments"
            tooltip="Concrete promises a person made in a Slack channel in the last 24h."
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
            label="Escalations"
            tooltip="Threads with ≥3 messages from ≥2 people showing repeated follow-ups WITHOUT resolution."
          />
          <div className="text-foreground tabular-nums mt-0.5">
            {c.escalations}
            {c.confusion > 0 && (
              <span className="text-amber-600 dark:text-amber-400"> · {c.confusion} confusion</span>
            )}
          </div>
        </div>
        <div>
          <MetricLabel
            label="Customers / Risks"
            tooltip="Named customer issues raised in channels / material risks flagged in chat (critical = severity ≥ high)."
          />
          <div className="text-foreground tabular-nums mt-0.5">
            {c.customer_issues} / {c.risks}
            {c.critical_risks > 0 && (
              <span className="text-red-600 dark:text-red-400"> · {c.critical_risks} critical</span>
            )}
          </div>
        </div>
      </div>

      {silent.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowSilent((v) => !v)}
            className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground"
          >
            {showSilent ? "Hide" : "View"} silent channels ({silent.length})
          </button>
          {showSilent && (
            <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
              {silent.map((s, i) => (
                <div key={i} className="text-[10px] text-muted-foreground leading-tight font-mono">
                  #{s.channel}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommsPulseCard({ emailPulse, slackPulse }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Leadership status from email pulse (slack equivalent doesn't exist yet)
  const status = emailPulse?.leadership_status || [];
  const silent = status.filter((s) => s.state === "silent");
  const optedOutLeaders = status.filter((s) => s.state === "opted_out");
  const notConnected = status.filter((s) => s.state === "not_connected");
  const errored = status.filter((s) => s.state === "error");

  const legacySilent =
    status.length === 0 && emailPulse?.silent_leaders
      ? emailPulse.silent_leaders.map<LeadershipStatusEntry>((s) => ({
          leader: s.leader,
          email: "",
          state: "silent",
          reason: s.reason,
        }))
      : [];

  const hasAnyComms = !!(emailPulse?.per_mailbox || slackPulse);
  if (!hasAnyComms) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Inbox className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground">
            No comms pulse data in this briefing — neither email nor Slack scan returned results.
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Comms Pulse — last 24h
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <EmailColumn pulse={emailPulse} />
          <SlackColumn pulse={slackPulse} />
        </div>

        {(silent.length > 0 || optedOutLeaders.length > 0 || notConnected.length > 0 || errored.length > 0 || legacySilent.length > 0) && (
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Leadership status (email signal)
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

        {((emailPulse?.per_mailbox && emailPulse.per_mailbox.length > 0) ||
          (slackPulse?.per_channel && slackPulse.per_channel.length > 0)) && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide" : "View"} per-source breakdown
            </Button>
            {expanded && (
              <div className="mt-2 space-y-3">
                {emailPulse?.per_mailbox && emailPulse.per_mailbox.length > 0 && (
                  <div className="rounded border border-border overflow-hidden">
                    <div className="px-2 py-1 bg-muted/50 text-[10px] font-mono uppercase tracking-wider text-foreground">
                      Per mailbox
                    </div>
                    <table className="w-full text-[11px]">
                      <thead className="bg-muted/30">
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
                        {emailPulse.per_mailbox.map((m, i) => (
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

                {slackPulse?.per_channel && slackPulse.per_channel.length > 0 && (
                  <div className="rounded border border-border overflow-hidden">
                    <div className="px-2 py-1 bg-muted/50 text-[10px] font-mono uppercase tracking-wider text-foreground">
                      Per channel
                    </div>
                    <table className="w-full text-[11px]">
                      <thead className="bg-muted/30">
                        <tr className="text-left">
                          <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Channel</th>
                          <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Status</th>
                          <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Msgs</th>
                          <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Commits</th>
                          <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Esc.</th>
                          <th className="px-2 py-1.5 font-mono uppercase tracking-wider">Risks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slackPulse.per_channel.map((m, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1.5 text-foreground font-mono">#{m.channel}</td>
                            <td className="px-2 py-1.5">
                              {m.status === "ok" ? (
                                <span className="text-green-600 dark:text-green-400">ok</span>
                              ) : (
                                <span className="text-muted-foreground">{m.status}</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">{m.messages_scanned}</td>
                            <td className="px-2 py-1.5 tabular-nums">{m.commitments}</td>
                            <td className="px-2 py-1.5 tabular-nums">{m.escalations}</td>
                            <td className="px-2 py-1.5 tabular-nums">{m.risks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Privacy: only opted-in mailboxes and channels Duncan is a member of are scanned. Content is
          sent to OpenAI for one-time extraction; only the structured signals above are persisted.
        </p>
      </div>
    </TooltipProvider>
  );
}
