import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Types ---

interface BasecampEvent {
  type: "todo_assigned" | "todo_completed" | "comment_created";
  todoTitle: string;
  projectName: string;
  assigneePersonId: number | null;
  assigneeName: string | null;
  creatorName: string;
  url: string;
}

// --- Event Parser ---

function parseEvent(body: any): BasecampEvent | null {
  const kind = body.kind;
  const recording = body.recording || {};
  const creator = body.creator || {};

  // Todo assignment
  if (kind === "todo_assignment_created" || kind === "todo_assigned") {
    const assignee = recording.assignees?.[0] || body.assignee || null;
    if (!assignee) return null;
    return {
      type: "todo_assigned",
      todoTitle: recording.title || recording.subject || "Untitled todo",
      projectName: body.bucket?.name || "Unknown project",
      assigneePersonId: assignee.id || null,
      assigneeName: assignee.name || null,
      creatorName: creator.name || "Someone",
      url: recording.app_url || recording.url || "",
    };
  }

  // Todo completed
  if (kind === "todo_completed") {
    // The completer is the creator of the event
    const completer = creator;
    return {
      type: "todo_completed",
      todoTitle: recording.title || recording.subject || "Untitled todo",
      projectName: body.bucket?.name || "Unknown project",
      assigneePersonId: completer.id || null,
      assigneeName: completer.name || null,
      creatorName: completer.name || "Someone",
      url: recording.app_url || recording.url || "",
    };
  }

  // Comment on a todo
  if (kind === "comment_created" && recording.parent?.type === "Todo") {
    // Notify the todo's assignees
    const parent = recording.parent;
    const assignee = parent.assignees?.[0] || null;
    return {
      type: "comment_created",
      todoTitle: parent.title || parent.subject || "Untitled todo",
      projectName: body.bucket?.name || "Unknown project",
      assigneePersonId: assignee?.id || null,
      assigneeName: assignee?.name || null,
      creatorName: creator.name || "Someone",
      url: recording.app_url || recording.url || "",
    };
  }

  return null;
}

// --- User Mapping ---

async function getSlackUser(
  supabase: any,
  basecampPersonId: number,
  basecampName: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_notification_mappings")
    .select("slack_user_identifier, is_active")
    .eq("basecamp_person_id", basecampPersonId)
    .maybeSingle();

  if (error || !data) {
    // Log unmapped user
    await supabase.from("unmapped_users_log").insert({
      basecamp_person_id: basecampPersonId,
      basecamp_name: basecampName || "Unknown",
      context: "basecamp-webhook",
    });
    return null;
  }

  if (!data.is_active) return null;
  return data.slack_user_identifier;
}

// --- Slack DM ---

async function sendSlackDM(
  slackUserId: string,
  message: string,
  slackApiKey: string
): Promise<boolean> {
  // Open DM channel
  const openRes = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slackApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ users: slackUserId }),
  });
  const openData = await openRes.json();
  if (!openData.ok) {
    console.error("Failed to open Slack DM:", openData.error);
    return false;
  }

  const channelId = openData.channel.id;

  // Send message
  const msgRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slackApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: channelId,
      text: message,
      username: "Duncan",
      icon_emoji: ":bell:",
    }),
  });
  const msgData = await msgRes.json();
  if (!msgData.ok) {
    console.error("Failed to send Slack message:", msgData.error);
    return false;
  }

  return true;
}

// --- Message Formatting ---

function formatMessage(event: BasecampEvent): string {
  const link = event.url ? `<${event.url}|${event.todoTitle}>` : event.todoTitle;

  switch (event.type) {
    case "todo_assigned":
      return `📋 *New task assigned to you*\n${link}\nProject: ${event.projectName}\nAssigned by: ${event.creatorName}`;
    case "todo_completed":
      return `✅ *Task completed*\n${link}\nProject: ${event.projectName}`;
    case "comment_created":
      return `💬 *New comment on your task*\n${link}\nProject: ${event.projectName}\nFrom: ${event.creatorName}`;
    default:
      return `📌 Update on: ${link}`;
  }
}

// --- Logging ---

async function logResult(
  supabase: any,
  slackUserId: string,
  payload: any,
  success: boolean
) {
  await supabase.from("slack_notification_logs").insert({
    slack_user_identifier: slackUserId,
    payload,
    status: success ? "sent" : "failed",
    sent_at: success ? new Date().toISOString() : null,
  });
}

// --- Main Handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Basecamp webhook received:", JSON.stringify(body).substring(0, 500));

    // Optional: validate account ID
    const expectedAccountId = Deno.env.get("BASECAMP_ACCOUNT_ID");
    if (expectedAccountId && body.account_id) {
      if (String(body.account_id) !== String(expectedAccountId)) {
        console.log(`Account ID mismatch: got ${body.account_id}, expected ${expectedAccountId}`);
        return new Response(JSON.stringify({ ignored: true, reason: "account_id_mismatch" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse the event
    const event = parseEvent(body);
    if (!event) {
      console.log(`Ignoring unsupported event kind: ${body.kind}`);
      return new Response(JSON.stringify({ ignored: true, reason: "unsupported_event", kind: body.kind }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!event.assigneePersonId) {
      console.log("No assignee person ID found, skipping");
      return new Response(JSON.stringify({ ignored: true, reason: "no_assignee" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Init Supabase (service role for inserts to logs)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up Slack user
    const slackUserId = await getSlackUser(supabase, event.assigneePersonId, event.assigneeName || "Unknown");
    if (!slackUserId) {
      console.log(`No Slack mapping for Basecamp person ${event.assigneePersonId}`);
      return new Response(JSON.stringify({ ignored: true, reason: "unmapped_user", basecamp_person_id: event.assigneePersonId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Don't notify yourself (comment on own task)
    if (event.type === "comment_created" && event.creatorName === event.assigneeName) {
      console.log("Skipping self-comment notification");
      return new Response(JSON.stringify({ ignored: true, reason: "self_comment" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send Slack DM
    const slackApiKey = Deno.env.get("SLACK_API_KEY");
    if (!slackApiKey) {
      console.error("SLACK_API_KEY not configured");
      await logResult(supabase, slackUserId, { event, error: "missing_slack_api_key" }, false);
      return new Response(JSON.stringify({ error: "Slack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = formatMessage(event);
    const success = await sendSlackDM(slackUserId, message, slackApiKey);

    // Log result
    await logResult(supabase, slackUserId, { type: event.type, todo: event.todoTitle, project: event.projectName }, success);

    console.log(`Webhook processed: type=${event.type}, slack=${slackUserId}, success=${success}`);
    return new Response(JSON.stringify({ success, type: event.type, slackUser: slackUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("basecamp-webhook error:", err);
    // Always return 200 to prevent Basecamp from retrying
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
