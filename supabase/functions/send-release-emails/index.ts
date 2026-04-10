import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured — please connect Resend first");

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
    if (!isAdmin) throw new Error("Only admins can send release emails");

    const { releaseId } = await req.json();
    if (!releaseId) throw new Error("releaseId is required");

    // Fetch release
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .select("*")
      .eq("id", releaseId)
      .single();
    if (releaseError || !release) throw new Error("Release not found");

    // Fetch all approved users
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("approval_status", "approved");
    if (profilesError) throw profilesError;

    // Get emails from auth (via service role)
    const allUsers: { id: string; email: string; name: string }[] = [];
    for (const profile of profiles ?? []) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.user_id);
      if (authUser?.email) {
        allUsers.push({ id: profile.user_id, email: authUser.email, name: profile.display_name || authUser.email });
      }
    }

    const appUrl = Deno.env.get("APP_URL") || "https://duncan-help.lovable.app";
    const changes = (release.changes as any[]) || [];

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const u of allUsers) {
      try {
        const html = buildEmailHtml(release, changes, u.name, appUrl);

        const response = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "Duncan <onboarding@resend.dev>",
            to: [u.email],
            subject: `Duncan ${release.version} — ${release.title}`,
            html,
          }),
        });

        const resData = await response.json();

        // Log the send
        await supabase.from("release_email_logs").insert({
          release_id: releaseId,
          user_id: u.id,
          recipient_email: u.email,
          status: response.ok ? "sent" : "failed",
          error_message: response.ok ? null : JSON.stringify(resData),
          sent_at: response.ok ? new Date().toISOString() : null,
        });

        if (response.ok) results.sent++;
        else {
          results.failed++;
          results.errors.push(`${u.email}: ${JSON.stringify(resData)}`);
        }
      } catch (err) {
        results.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${u.email}: ${msg}`);
        await supabase.from("release_email_logs").insert({
          release_id: releaseId,
          user_id: u.id,
          recipient_email: u.email,
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
    console.error("send-release-emails error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmailHtml(
  release: any,
  changes: { type: string; description: string }[],
  userName: string,
  appUrl: string,
): string {
  const improvements = changes.filter((c) => c.type === "improvement");
  const fixes = changes.filter((c) => c.type === "fix");
  const features = changes.filter((c) => c.type === "feature");
  const other = changes.filter((c) => !["improvement", "fix", "feature"].includes(c.type));

  const section = (title: string, emoji: string, items: typeof changes) =>
    items.length
      ? `<tr><td style="padding:16px 0 8px"><h3 style="margin:0;font-size:14px;font-weight:600;color:#1a1f2c">${emoji} ${title}</h3></td></tr>
         ${items.map((i) => `<tr><td style="padding:4px 0 4px 16px;font-size:13px;color:#555;line-height:1.5">• ${escapeHtml(i.description)}</td></tr>`).join("")}`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Inter',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <tr><td style="background:linear-gradient(135deg,#1a9e8f,#16a085);padding:32px 40px">
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff">Duncan ${escapeHtml(release.version)}</h1>
    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85)">${escapeHtml(release.title)}</p>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <p style="margin:0 0 4px;font-size:13px;color:#999">Hi ${escapeHtml(userName)},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">${escapeHtml(release.summary)}</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${section("New Features", "🚀", features)}
      ${section("Improvements", "✨", improvements)}
      ${section("Bug Fixes", "🐛", fixes)}
      ${section("Other Changes", "📋", other)}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px">
      <tr><td align="center">
        <a href="${appUrl}/whats-new" style="display:inline-block;background:#1a9e8f;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none">View What's New</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 40px;border-top:1px solid #eee">
    <p style="margin:0;font-size:11px;color:#aaa;text-align:center">Duncan by Kabuni • ${new Date().getFullYear()}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
