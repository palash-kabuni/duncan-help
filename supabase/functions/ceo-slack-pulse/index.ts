// Company-wide Slack pulse for the CEO briefing.
// Scans the last 24h of channel conversations the bot is a member of,
// runs a lightweight gpt-4o-mini extraction per channel, and surfaces
// commitments, escalations, confusion, customer issues, and silent channels.
//
// Mirrors ceo-email-pulse in shape so the briefing can treat email and
// slack as parallel "comms pulse" inputs.
//
// Privacy: raw Slack messages are sent to OpenAI for one-time extraction
// only. Nothing other than the structured JSON below is persisted.
// Read-only: bot only listens; it does not post, react, or DM.

import { callLLMWithFallback } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const WINDOW_SECONDS = 24 * 60 * 60;
const MAX_CHANNELS = 30;
const MAX_MESSAGES_PER_CHANNEL = 200;

interface SlackChannel {
  id: string;
  name: string;
  is_member?: boolean;
  is_archived?: boolean;
  is_private?: boolean;
  num_members?: number;
}

interface SlackMessage {
  ts: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
}

async function slackCall(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
  lovableKey: string,
): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const url = `${GATEWAY_URL}/${endpoint}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": apiKey,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Slack ${endpoint} HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

async function listAllChannels(
  apiKey: string,
  lovableKey: string,
): Promise<{ channels: SlackChannel[]; degraded: boolean; degraded_reason: string | null }> {
  const all: SlackChannel[] = [];
  let cursor = "";
  let pages = 0;
  let degraded = false;
  let degraded_reason: string | null = null;
  // Public channels only — `private_channel` requires `groups:read` scope which the
  // bot does not currently have. Including it causes Slack to throw `missing_scope`
  // and the whole pulse to fail. Private channel scanning is gated on an explicit
  // scope decision (see CEO briefing plan).
  do {
    const params: Record<string, string> = {
      types: "public_channel",
      exclude_archived: "true",
      limit: "200",
    };
    if (cursor) params.cursor = cursor;
    try {
      const data = await slackCall("conversations.list", params, apiKey, lovableKey);
      if (!data.ok) {
        const err = String(data.error || "unknown");
        if (err === "missing_scope" || err === "not_authed" || err === "invalid_auth") {
          degraded = true;
          degraded_reason = `conversations.list returned ${err} — connector scopes insufficient`;
          break;
        }
        throw new Error(`conversations.list error: ${err}`);
      }
      for (const c of (data.channels || []) as SlackChannel[]) all.push(c);
      cursor = data.response_metadata?.next_cursor || "";
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/missing_scope|not_authed|invalid_auth|not_in_channel/i.test(msg)) {
        degraded = true;
        degraded_reason = `conversations.list permission error — ${msg.slice(0, 200)}`;
        break;
      }
      throw e;
    }
    pages++;
    if (pages > 10) break; // safety
  } while (cursor);
  return { channels: all, degraded, degraded_reason };
}

async function fetchChannelHistory(
  channelId: string,
  oldest: number,
  apiKey: string,
  lovableKey: string,
  botUserId: string,
): Promise<SlackMessage[]> {
  try {
    const data = await slackCall(
      "conversations.history",
      {
        channel: channelId,
        oldest: String(oldest),
        limit: String(MAX_MESSAGES_PER_CHANNEL),
        inclusive: "false",
      },
      apiKey,
      lovableKey,
    );
    if (!data.ok) return [];
    const messages = (data.messages || []) as SlackMessage[];
    return messages.filter((m) => {
      // Skip bot/system messages and Duncan's own posts
      if (m.bot_id) return false;
      if (m.subtype && ["channel_join", "channel_leave", "bot_message", "channel_topic", "channel_purpose"].includes(m.subtype)) return false;
      if (m.user && m.user === botUserId) return false;
      if (!m.text || !m.text.trim()) return false;
      return true;
    });
  } catch (e) {
    console.warn(`history failed for ${channelId}:`, e);
    return [];
  }
}

async function getBotUserId(apiKey: string, lovableKey: string): Promise<string> {
  try {
    const data = await slackCall("auth.test", {}, apiKey, lovableKey);
    return data?.user_id || "";
  } catch {
    return "";
  }
}

async function resolveUsernames(
  userIds: string[],
  apiKey: string,
  lovableKey: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  // Batch via users.info one-at-a-time (no bulk endpoint), capped to avoid runaway.
  const capped = unique.slice(0, 100);
  await Promise.all(
    capped.map(async (uid) => {
      try {
        const data = await slackCall("users.info", { user: uid }, apiKey, lovableKey);
        if (data?.ok && data.user) {
          const name =
            data.user.profile?.display_name ||
            data.user.real_name ||
            data.user.name ||
            uid;
          map.set(uid, name);
        }
      } catch {
        // ignore individual lookup failures
      }
    }),
  );
  return map;
}

function parseLLMJson(raw: string): any {
  let s = String(raw ?? "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const objMatch = s.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error("No JSON object found in LLM response");
  }
}

function replaceUserMentions(text: string, nameMap: Map<string, string>): string {
  return text.replace(/<@(U[A-Z0-9]+)>/g, (_, uid) => `@${nameMap.get(uid) || uid}`);
}

async function extractChannelSignals(
  channelName: string,
  messages: Array<{ author: string; text: string; ts: string; thread_ts?: string }>,
): Promise<any> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || messages.length === 0) {
    return {
      commitments: [],
      escalations: [],
      confusion: [],
      customer_issues: [],
      risks: [],
    };
  }

  const compact = messages.slice(0, MAX_MESSAGES_PER_CHANNEL).map((m) => ({
    author: m.author,
    text: m.text.slice(0, 500),
    thread: m.thread_ts || null,
  }));

  const systemPrompt = `You are an executive intelligence extractor analysing a 24h slice of one Slack channel (#${channelName}) for the CEO of Kabuni. Surface ONLY high-signal items. Ignore casual chatter, gifs, social, and routine acknowledgements.

OUTPUT FORMAT: Return ONLY a single raw JSON object. No markdown, no code fences, no prose. Start with { and end with }.`;

  const userPrompt = `Channel: #${channelName}
Messages (last 24h, oldest first):
${JSON.stringify(compact).slice(0, 60000)}

Return JSON with this exact shape:
{
  "commitments":   [{ "owner": string, "what": string, "due": string|null }],
  "escalations":   [{ "topic": string, "people": string[], "urgency": "low"|"medium"|"high", "reason": string }],
  "confusion":     [{ "topic": string, "people": string[], "what_is_unclear": string }],
  "customer_issues":[{ "company": string, "issue": string, "severity": "low"|"medium"|"high" }],
  "risks":         [{ "severity": "low"|"medium"|"high"|"critical", "summary": string, "who_flagged": string }]
}

RULES:
- Empty arrays are fine — do NOT invent items.
- Commitments: a person promising a specific action by a date or soon. Owner must be a real person mentioned (use the @name as written).
- Escalations: a thread where ≥3 messages from ≥2 people show repeated follow-ups WITHOUT resolution.
- Confusion: messages showing ownership ambiguity ("who owns this?", "is X or Y doing this?", "wait, I thought…").
- Customer issues: a named customer/company has a problem.
- Risks: material risks for 2026 priorities (India launch, KPL, trials, Duncan automation) or finance/legal/customers.
- Keep summaries under 20 words each.`;

  try {
    const data = await callLLMWithFallback({
      workflow: "ceo-slack-pulse",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = parseLLMJson(raw);
    return {
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
      escalations: Array.isArray(parsed.escalations) ? parsed.escalations : [],
      confusion: Array.isArray(parsed.confusion) ? parsed.confusion : [],
      customer_issues: Array.isArray(parsed.customer_issues) ? parsed.customer_issues : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    };
  } catch (e) {
    console.error(`extractChannelSignals error for #${channelName}:`, e);
    return {
      commitments: [],
      escalations: [],
      confusion: [],
      customer_issues: [],
      risks: [],
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!SLACK_API_KEY || !LOVABLE_API_KEY) {
      return json({
        ok: false,
        error: "Slack connector not configured",
        channels_total: 0,
        channels_eligible: 0,
        channels_scanned: 0,
        per_channel: [],
        signals: emptySignals(),
      });
    }

    const oldest = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;
    const botUserId = await getBotUserId(SLACK_API_KEY, LOVABLE_API_KEY);

    // 1. Discover channels
    let allChannels: SlackChannel[] = [];
    let degraded = false;
    let degraded_reason: string | null = null;
    try {
      const listed = await listAllChannels(SLACK_API_KEY, LOVABLE_API_KEY);
      allChannels = listed.channels;
      degraded = listed.degraded;
      degraded_reason = listed.degraded_reason;
    } catch (e: any) {
      console.error("listAllChannels failed:", e);
      return json({
        ok: true,
        degraded: true,
        degraded_reason: `channel listing failed: ${e?.message || String(e)}`,
        window_hours: 24,
        channels_total: 0,
        channels_member: 0,
        channels_eligible: 0,
        channels_scanned: 0,
        messages_analysed: 0,
        not_member_channels: [],
        per_channel: [],
        silent_channels: [],
        signals: emptySignals(),
        generated_at: new Date().toISOString(),
      });
    }
    const memberChannels = allChannels.filter((c) => c.is_member && !c.is_archived);

    // Cap to top N by member count as a proxy for activity
    const eligible = [...memberChannels]
      .sort((a, b) => (b.num_members || 0) - (a.num_members || 0))
      .slice(0, MAX_CHANNELS);

    // 2. Pull history per channel (in parallel, capped concurrency)
    const channelResults = await Promise.all(
      eligible.map(async (ch) => {
        try {
          const rawMessages = await fetchChannelHistory(
            ch.id,
            oldest,
            SLACK_API_KEY,
            LOVABLE_API_KEY,
            botUserId,
          );
          return { channel: ch, messages: rawMessages };
        } catch (e: any) {
          return { channel: ch, messages: [] as SlackMessage[], error: e?.message || String(e) };
        }
      }),
    );

    // 3. Resolve user IDs across all messages
    const allUserIds = new Set<string>();
    for (const r of channelResults) {
      for (const m of r.messages) if (m.user) allUserIds.add(m.user);
      // also collect mentioned users in text
      for (const m of r.messages) {
        const matches = (m.text || "").matchAll(/<@(U[A-Z0-9]+)>/g);
        for (const mm of matches) allUserIds.add(mm[1]);
      }
    }
    const nameMap = await resolveUsernames(Array.from(allUserIds), SLACK_API_KEY, LOVABLE_API_KEY);

    // 4. Extract signals per channel
    const perChannelOutput = await Promise.all(
      channelResults.map(async (r) => {
        const enriched = r.messages.map((m) => ({
          author: nameMap.get(m.user || "") || m.user || "unknown",
          text: replaceUserMentions(m.text || "", nameMap),
          ts: m.ts,
          thread_ts: m.thread_ts,
        }));
        if (enriched.length === 0) {
          return {
            channel_id: r.channel.id,
            channel_name: r.channel.name,
            messages_scanned: 0,
            signals: emptySignals(),
            status: r.channel.is_member ? "no_messages" : "not_member",
          };
        }
        const signals = await extractChannelSignals(r.channel.name, enriched);
        return {
          channel_id: r.channel.id,
          channel_name: r.channel.name,
          messages_scanned: enriched.length,
          signals,
          status: "ok",
        };
      }),
    );

    // 5. Aggregate
    const allCommitments: any[] = [];
    const allEscalations: any[] = [];
    const allConfusion: any[] = [];
    const allCustomerIssues: any[] = [];
    const allRisks: any[] = [];
    const silentChannels: Array<{ channel: string; reason: string }> = [];
    let totalMessages = 0;

    for (const r of perChannelOutput) {
      totalMessages += r.messages_scanned;
      if (r.status === "no_messages") {
        silentChannels.push({ channel: r.channel_name, reason: "0 human messages in last 24h" });
        continue;
      }
      const tag = (arr: any[]) => arr.map((x) => ({ ...x, _channel: r.channel_name }));
      allCommitments.push(...tag(r.signals.commitments));
      allEscalations.push(...tag(r.signals.escalations));
      allConfusion.push(...tag(r.signals.confusion));
      allCustomerIssues.push(...tag(r.signals.customer_issues));
      allRisks.push(...tag(r.signals.risks));
    }

    // Channels the bot is NOT a member of (so the team can invite Duncan)
    const notMember = allChannels
      .filter((c) => !c.is_member && !c.is_archived)
      .map((c) => ({ id: c.id, name: c.name, is_private: !!c.is_private }));

    return json({
      ok: true,
      degraded,
      degraded_reason,
      window_hours: 24,
      channels_total: allChannels.length,
      channels_member: memberChannels.length,
      channels_eligible: eligible.length,
      channels_scanned: perChannelOutput.length,
      messages_analysed: totalMessages,
      not_member_channels: notMember.slice(0, 50),
      per_channel: perChannelOutput.map((r) => ({
        channel: r.channel_name,
        status: r.status,
        messages_scanned: r.messages_scanned,
        commitments: r.signals.commitments.length,
        escalations: r.signals.escalations.length,
        confusion: r.signals.confusion.length,
        customer_issues: r.signals.customer_issues.length,
        risks: r.signals.risks.length,
      })),
      silent_channels: silentChannels,
      signals: {
        commitments: allCommitments,
        escalations: allEscalations,
        confusion: allConfusion,
        customer_issues: allCustomerIssues,
        risks: allRisks,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("ceo-slack-pulse error:", e);
    return json({ ok: false, error: e?.message || "ceo-slack-pulse failed" }, 500);
  }
});

function emptySignals() {
  return {
    commitments: [],
    escalations: [],
    confusion: [],
    customer_issues: [],
    risks: [],
  };
}
