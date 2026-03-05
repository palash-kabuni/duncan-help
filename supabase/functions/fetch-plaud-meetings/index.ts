import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GMAIL_API = "https://www.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function getGmailAccessToken(supabaseAdmin: any): Promise<string | null> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const { data: tokenData, error } = await supabaseAdmin
    .from("gmail_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !tokenData) return null;

  if (new Date(tokenData.token_expiry) <= new Date()) {
    const refreshRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!refreshRes.ok) {
      console.error("Gmail token refresh failed:", await refreshRes.text());
      return null;
    }

    const newTokens = await refreshRes.json();
    const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000);

    await supabaseAdmin
      .from("gmail_tokens")
      .update({
        access_token: newTokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq("id", tokenData.id);

    return newTokens.access_token;
  }

  return tokenData.access_token;
}

function extractSenderEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

function base64UrlDecode(data: string): Uint8Array {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

function extractPlainTextBody(payload: any): string {
  // Recursively search for text/plain parts
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    const decoded = new TextDecoder().decode(base64UrlDecode(payload.body.data));
    return decoded;
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }
  // Fallback to text/html
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const decoded = new TextDecoder().decode(base64UrlDecode(payload.body.data));
    return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

interface Attachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const gmailToken = await getGmailAccessToken(supabaseAdmin);

    if (!gmailToken) {
      return new Response(
        JSON.stringify({ error: "Gmail not connected. An admin needs to connect it first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = { Authorization: `Bearer ${gmailToken}` };

    // Search for Plaud AI emails - they come from noreply@plaud.ai or similar
    // Also search for common patterns in Plaud emails
    const query = `from:plaud OR subject:"plaud" OR subject:"meeting recording" OR subject:"voice note" OR subject:"transcript" from:noreply@plaud.ai`;
    console.log("Gmail search query for Plaud:", query);

    const searchUrl = new URL(`${GMAIL_API}/messages`);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("maxResults", "30");

    const searchRes = await fetch(searchUrl.toString(), { headers });
    if (!searchRes.ok) {
      throw new Error(`Gmail search failed: ${await searchRes.text()}`);
    }

    const searchData = await searchRes.json();
    const messages = searchData.messages || [];
    console.log(`Found ${messages.length} Plaud-related emails`);

    let fetched = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const msg of messages) {
      // Check if already fetched
      const { data: existing } = await supabaseAdmin
        .from("meetings")
        .select("id")
        .eq("gmail_message_id", msg.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Fetch full message
      const msgRes = await fetch(`${GMAIL_API}/messages/${msg.id}?format=full`, { headers });
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      const msgHeaders = msgData.payload?.headers || [];
      const subject = msgHeaders.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
      const from = msgHeaders.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
      const dateHeader = msgHeaders.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
      const senderEmail = extractSenderEmail(from);

      // Extract email body text (may contain transcript)
      const bodyText = extractPlainTextBody(msgData.payload);

      // Collect attachments - transcripts (.txt, .docx, .pdf) and audio (.mp3, .m4a, .wav, .webm)
      const transcriptAttachments: Attachment[] = [];
      const audioAttachments: Attachment[] = [];

      function collectAttachments(parts: any[]) {
        for (const part of parts) {
          const filename = (part.filename || "").toLowerCase();
          if (part.body?.attachmentId) {
            if (filename.endsWith(".txt") || filename.endsWith(".docx") || filename.endsWith(".pdf")) {
              transcriptAttachments.push({
                attachmentId: part.body.attachmentId,
                filename: part.filename,
                mimeType: part.mimeType,
              });
            } else if (
              filename.endsWith(".mp3") || filename.endsWith(".m4a") ||
              filename.endsWith(".wav") || filename.endsWith(".webm") ||
              filename.endsWith(".ogg") || filename.endsWith(".aac")
            ) {
              audioAttachments.push({
                attachmentId: part.body.attachmentId,
                filename: part.filename,
                mimeType: part.mimeType,
              });
            }
          }
          if (part.parts) collectAttachments(part.parts);
        }
      }
      collectAttachments(msgData.payload?.parts || []);

      // Download and store transcript attachments
      let transcriptText = "";
      for (const att of transcriptAttachments) {
        try {
          const attachRes = await fetch(
            `${GMAIL_API}/messages/${msg.id}/attachments/${att.attachmentId}`,
            { headers }
          );
          if (!attachRes.ok) continue;
          const attachData = await attachRes.json();
          const bytes = base64UrlDecode(attachData.data);

          if (att.filename.toLowerCase().endsWith(".txt")) {
            transcriptText = new TextDecoder().decode(bytes);
          } else {
            // For .docx/.pdf, store and we'll parse later
            transcriptText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
            // Clean up binary noise for non-txt files
            transcriptText = transcriptText.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").slice(0, 50000);
          }
        } catch (e) {
          console.error(`Failed to download transcript attachment ${att.filename}:`, e);
        }
      }

      // If no transcript from attachments, use email body
      if (!transcriptText && bodyText.length > 100) {
        transcriptText = bodyText;
      }

      // Download and store audio attachments
      let audioStoragePath: string | null = null;
      for (const att of audioAttachments) {
        try {
          const attachRes = await fetch(
            `${GMAIL_API}/messages/${msg.id}/attachments/${att.attachmentId}`,
            { headers }
          );
          if (!attachRes.ok) continue;
          const attachData = await attachRes.json();
          const bytes = base64UrlDecode(attachData.data);

          const storagePath = `${Date.now()}_${att.filename}`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from("meeting-audio")
            .upload(storagePath, bytes, {
              contentType: att.mimeType || "audio/mpeg",
              upsert: false,
            });

          if (!uploadError) {
            audioStoragePath = storagePath;
            console.log(`Uploaded audio: ${storagePath}`);
          } else {
            console.error("Audio upload error:", uploadError);
          }
        } catch (e) {
          console.error(`Failed to download audio ${att.filename}:`, e);
        }
      }

      // Parse meeting date from email date header
      let meetingDate: string | null = null;
      try {
        meetingDate = new Date(dateHeader).toISOString();
      } catch {
        meetingDate = new Date().toISOString();
      }

      // Generate a title from the subject
      const title = subject || "Plaud Meeting Recording";

      // Insert meeting record
      const { data: meeting, error: insertError } = await supabaseAdmin
        .from("meetings")
        .insert({
          title,
          meeting_date: meetingDate,
          transcript: transcriptText || null,
          audio_storage_path: audioStoragePath,
          gmail_message_id: msg.id,
          email_subject: subject,
          sender_email: senderEmail,
          source: "plaud",
          status: transcriptText ? "transcribed" : (audioStoragePath ? "audio_only" : "pending"),
          fetched_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert meeting error:", insertError);
        continue;
      }

      results.push({
        id: meeting.id,
        title: meeting.title,
        status: meeting.status,
        has_transcript: !!transcriptText,
        has_audio: !!audioStoragePath,
      });
      fetched++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        fetched,
        skipped,
        total_emails: messages.length,
        meetings: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fetch Plaud meetings error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch Plaud meetings" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
