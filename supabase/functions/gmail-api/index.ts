import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function getValidToken(
  supabaseAdmin: any,
  userId: string
): Promise<{ accessToken: string; emailAddress: string | null } | null> {
  const { data: tokenRow, error } = await supabaseAdmin
    .from("gmail_tokens")
    .select("*")
    .eq("connected_by", userId)
    .maybeSingle();

  if (error || !tokenRow) return null;

  const now = new Date();
  const expiry = new Date(tokenRow.token_expiry);

  // If token expires within 5 minutes, refresh
  if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;
    const refreshed = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);

    if (!refreshed) return null;

    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
    await supabaseAdmin
      .from("gmail_tokens")
      .update({
        access_token: refreshed.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq("id", tokenRow.id);

    return { accessToken: refreshed.access_token, emailAddress: tokenRow.email_address };
  }

  return { accessToken: tokenRow.access_token, emailAddress: tokenRow.email_address };
}

function buildRFC2822(to: string, cc: string, bcc: string, subject: string, body: string, fromEmail: string): string {
  const lines: string[] = [];
  lines.push(`From: ${fromEmail}`);
  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push("");
  lines.push(body);
  return lines.join("\r\n");
}

function base64url(str: string): string {
  const encoded = btoa(unescape(encodeURIComponent(str)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action } = body;

    // ─── STATUS ───
    if (action === "status") {
      const { data: tokenRow } = await supabaseAdmin
        .from("gmail_tokens")
        .select("email_address, token_expiry, updated_at")
        .eq("connected_by", user.id)
        .maybeSingle();

      if (!tokenRow) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expired = new Date(tokenRow.token_expiry).getTime() < Date.now();
      return new Response(
        JSON.stringify({
          connected: true,
          email: tokenRow.email_address,
          lastSync: tokenRow.updated_at,
          expired,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DISCONNECT ───
    if (action === "disconnect") {
      await supabaseAdmin.from("gmail_tokens").delete().eq("connected_by", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require a valid token
    const tokenData = await getValidToken(supabaseAdmin, user.id);
    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: "Gmail not connected or token expired. Please reconnect." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gmailHeaders = { Authorization: `Bearer ${tokenData.accessToken}` };

    // ─── LIST EMAILS ───
    if (action === "list") {
      const { pageToken, maxResults = 20 } = body;
      const params = new URLSearchParams({
        maxResults: String(maxResults),
        labelIds: "INBOX",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        { headers: gmailHeaders }
      );
      if (!listRes.ok) {
        const err = await listRes.text();
        throw new Error(`Gmail list failed: ${err}`);
      }
      const listData = await listRes.json();
      const messages = listData.messages || [];

      // Fetch metadata for each message
      const detailed = await Promise.all(
        messages.map(async (m: any) => {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: gmailHeaders }
          );
          if (!res.ok) return null;
          const msg = await res.json();
          const headers = msg.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
          return {
            id: msg.id,
            threadId: msg.threadId,
            from: getHeader("From"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            snippet: msg.snippet,
            labelIds: msg.labelIds,
            isUnread: (msg.labelIds || []).includes("UNREAD"),
          };
        })
      );

      return new Response(
        JSON.stringify({
          emails: detailed.filter(Boolean),
          nextPageToken: listData.nextPageToken || null,
          resultSizeEstimate: listData.resultSizeEstimate,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SEARCH EMAILS ───
    if (action === "search") {
      const { query, pageToken, maxResults = 20 } = body;
      if (!query) throw new Error("Search query is required");

      const params = new URLSearchParams({
        q: query,
        maxResults: String(maxResults),
      });
      if (pageToken) params.set("pageToken", pageToken);

      const searchRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        { headers: gmailHeaders }
      );
      if (!searchRes.ok) {
        const err = await searchRes.text();
        throw new Error(`Gmail search failed: ${err}`);
      }
      const searchData = await searchRes.json();
      const messages = searchData.messages || [];

      const detailed = await Promise.all(
        messages.map(async (m: any) => {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: gmailHeaders }
          );
          if (!res.ok) return null;
          const msg = await res.json();
          const headers = msg.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
          return {
            id: msg.id,
            threadId: msg.threadId,
            from: getHeader("From"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            snippet: msg.snippet,
            labelIds: msg.labelIds,
            isUnread: (msg.labelIds || []).includes("UNREAD"),
          };
        })
      );

      return new Response(
        JSON.stringify({
          emails: detailed.filter(Boolean),
          nextPageToken: searchData.nextPageToken || null,
          resultSizeEstimate: searchData.resultSizeEstimate,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── READ EMAIL ───
    if (action === "read") {
      const { messageId } = body;
      if (!messageId) throw new Error("messageId is required");

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: gmailHeaders }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail read failed: ${err}`);
      }
      const msg = await res.json();
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      // Extract body - try HTML first, then plain text
      let htmlBody = "";
      let textBody = "";

      function extractParts(payload: any) {
        if (payload.mimeType === "text/html" && payload.body?.data) {
          htmlBody = atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        } else if (payload.mimeType === "text/plain" && payload.body?.data) {
          textBody = atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            extractParts(part);
          }
        }
      }
      extractParts(msg.payload);

      return new Response(
        JSON.stringify({
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader("From"),
          to: getHeader("To"),
          cc: getHeader("Cc"),
          bcc: getHeader("Bcc"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          snippet: msg.snippet,
          htmlBody: htmlBody || undefined,
          textBody: textBody || undefined,
          labelIds: msg.labelIds,
          isUnread: (msg.labelIds || []).includes("UNREAD"),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SEND EMAIL ───
    if (action === "send") {
      const { to, cc, bcc, subject, body: emailBody } = body;
      if (!to || !subject || !emailBody) {
        throw new Error("to, subject, and body are required");
      }

      const fromEmail = tokenData.emailAddress || "me";
      const formattedBody = emailBody
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
      const rawMessage = buildRFC2822(to, cc || "", bcc || "", subject, formattedBody, fromEmail);
      const encoded = base64url(rawMessage);

      const sendRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            ...gmailHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: encoded }),
        }
      );

      if (!sendRes.ok) {
        const err = await sendRes.text();
        throw new Error(`Gmail send failed: ${err}`);
      }

      const result = await sendRes.json();
      return new Response(
        JSON.stringify({ success: true, messageId: result.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Gmail API error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
