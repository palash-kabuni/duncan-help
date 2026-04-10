import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SLACK_GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) throw new Error("SLACK_API_KEY is not configured — please connect Slack first");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can send release notifications");

    const { releaseId } = await req.json();
    if (!releaseId) throw new Error("releaseId is required");

    // Fetch release
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .select("*")
      .eq("id", releaseId)
      .single();
    if (releaseError || !release) throw new Error("Release not found");

    // Fetch all mapped users with Slack IDs
    const { data: mappings, error: mappingsError } = await supabase
      .from("user_notification_mappings")
      .select("duncan_user_id, slack_user_identifier, basecamp_name")
      .eq("is_active", true);
    if (mappingsError) throw mappingsError;

    const slackHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    const appUrl = Deno.env.get("APP_URL") || "https://duncan-help.lovable.app";
    const changes = (release.changes as any[]) || [];
    const messageText = buildSlackMessage(release, changes, appUrl);

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const mapping of mappings ?? []) {
      try {
        // Open DM channel
        const openRes = await fetch(`${SLACK_GATEWAY_URL}/conversations.open`, {
          method: "POST",
          headers: slackHeaders,
          body: JSON.stringify({ users: mapping.slack_user_identifier }),
        });
        const openData = await openRes.json();
        if (!openData.ok) {
          throw new Error(`conversations.open failed: ${openData.error}`);
        }

        // Send message
        const msgRes = await fetch(`${SLACK_GATEWAY_URL}/chat.postMessage`, {
          method: "POST",
          headers: slackHeaders,
          body: JSON.stringify({
            channel: openData.channel.id,
            text: messageText,
            blocks: buildSlackBlocks(release, changes, appUrl),
            username: "Duncan",
            icon_emoji: ":mega:",
          }),
        });
        const msgData = await msgRes.json();

        // Log the send
        await supabase.from("release_email_logs").insert({
          release_id: releaseId,
          user_id: mapping.duncan_user_id,
          recipient_email: `slack:${mapping.slack_user_identifier}`,
          status: msgData.ok ? "sent" : "failed",
          error_message: msgData.ok ? null : JSON.stringify(msgData),
          sent_at: msgData.ok ? new Date().toISOString() : null,
        });

        if (msgData.ok) results.sent++;
        else {
          results.failed++;
          results.errors.push(`${mapping.basecamp_name}: ${JSON.stringify(msgData)}`);
        }
      } catch (err) {
        results.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${mapping.basecamp_name}: ${msg}`);
        await supabase.from("release_email_logs").insert({
          release_id: releaseId,
          user_id: mapping.duncan_user_id,
          recipient_email: `slack:${mapping.slack_user_identifier}`,
          status: "failed",
          error_message: msg,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-release-notifications error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSlackMessage(release: any, changes: { type: string; description: string }[], appUrl: string): string {
  const lines = [`🚀 *Duncan ${release.version} — ${release.title}*`, "", release.summary, ""];
  const features = changes.filter((c) => c.type === "feature");
  const improvements = changes.filter((c) => c.type === "improvement");
  const fixes = changes.filter((c) => c.type === "fix");

  if (features.length) { lines.push("*New Features*"); features.forEach((c) => lines.push(`• ${c.description}`)); lines.push(""); }
  if (improvements.length) { lines.push("*Improvements*"); improvements.forEach((c) => lines.push(`• ${c.description}`)); lines.push(""); }
  if (fixes.length) { lines.push("*Bug Fixes*"); fixes.forEach((c) => lines.push(`• ${c.description}`)); lines.push(""); }

  lines.push(`<${appUrl}/whats-new|View What's New>`);
  return lines.join("\n");
}

function buildSlackBlocks(release: any, changes: { type: string; description: string }[], appUrl: string): any[] {
  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: `🚀 Duncan ${release.version} — ${release.title}`, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: release.summary } },
  ];

  const features = changes.filter((c) => c.type === "feature");
  const improvements = changes.filter((c) => c.type === "improvement");
  const fixes = changes.filter((c) => c.type === "fix");

  if (features.length) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*🚀 New Features*\n${features.map((c) => `• ${c.description}`).join("\n")}` } });
  }
  if (improvements.length) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*✨ Improvements*\n${improvements.map((c) => `• ${c.description}`).join("\n")}` } });
  }
  if (fixes.length) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*🐛 Bug Fixes*\n${fixes.map((c) => `• ${c.description}`).join("\n")}` } });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "actions",
    elements: [{ type: "button", text: { type: "plain_text", text: "View What's New", emoji: true }, url: `${appUrl}/whats-new` }],
  });

  return blocks;
}
