import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GMAIL_API = "https://www.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function getAccessToken(supabaseAdmin: any): Promise<{ token: string; email: string } | null> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const { data: tokenData, error } = await supabaseAdmin
    .from("gmail_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !tokenData) return null;

  // Refresh if expired
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

    if (!refreshRes.ok) return null;

    const newTokens = await refreshRes.json();
    const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000);

    await supabaseAdmin
      .from("gmail_tokens")
      .update({
        access_token: newTokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq("id", tokenData.id);

    return { token: newTokens.access_token, email: tokenData.email_address || "" };
  }

  return { token: tokenData.access_token, email: tokenData.email_address || "" };
}

function extractNameFromEmail(fromHeader: string): string {
  // "John Doe <john@example.com>" → "John Doe"
  const match = fromHeader.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  // Just an email
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  return emailMatch ? emailMatch[1] : fromHeader;
}

function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const credentials = await getAccessToken(supabaseAdmin);

    if (!credentials) {
      return new Response(
        JSON.stringify({ error: "Gmail not connected. An admin needs to connect it first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = { Authorization: `Bearer ${credentials.token}` };

    // Search for emails with attachments (CV-related)
    // Look for emails with attachments that have common CV file extensions
    const query = "has:attachment (filename:pdf OR filename:docx OR filename:doc)";
    const searchUrl = new URL(`${GMAIL_API}/messages`);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("maxResults", "20");

    const searchRes = await fetch(searchUrl.toString(), { headers });
    if (!searchRes.ok) {
      throw new Error(`Gmail search failed: ${await searchRes.text()}`);
    }

    const searchData = await searchRes.json();
    const messages = searchData.messages || [];

    let ingested = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const msg of messages) {
      // Check if we already have this message
      const { data: existing } = await supabaseAdmin
        .from("candidates")
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

      // Extract headers
      const msgHeaders = msgData.payload?.headers || [];
      const subject = msgHeaders.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
      const from = msgHeaders.find((h: any) => h.name.toLowerCase() === "from")?.value || "";

      const candidateName = extractNameFromEmail(from);
      const candidateEmail = extractEmailAddress(from);

      // Find attachments (PDF, DOCX, DOC)
      const parts = msgData.payload?.parts || [];
      let cvAttachment: any = null;

      for (const part of parts) {
        const filename = (part.filename || "").toLowerCase();
        if (
          part.body?.attachmentId &&
          (filename.endsWith(".pdf") || filename.endsWith(".docx") || filename.endsWith(".doc"))
        ) {
          cvAttachment = { id: part.body.attachmentId, filename: part.filename, mimeType: part.mimeType };
          break;
        }
        // Check nested parts (multipart messages)
        if (part.parts) {
          for (const nested of part.parts) {
            const nestedFilename = (nested.filename || "").toLowerCase();
            if (
              nested.body?.attachmentId &&
              (nestedFilename.endsWith(".pdf") || nestedFilename.endsWith(".docx") || nestedFilename.endsWith(".doc"))
            ) {
              cvAttachment = { id: nested.body.attachmentId, filename: nested.filename, mimeType: nested.mimeType };
              break;
            }
          }
          if (cvAttachment) break;
        }
      }

      if (!cvAttachment) {
        skipped++;
        continue;
      }

      // Download attachment
      const attachRes = await fetch(
        `${GMAIL_API}/messages/${msg.id}/attachments/${cvAttachment.id}`,
        { headers }
      );
      if (!attachRes.ok) continue;
      const attachData = await attachRes.json();

      // Decode base64url to binary
      const base64Data = attachData.data.replace(/-/g, "+").replace(/_/g, "/");
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Upload to storage
      const storagePath = `${Date.now()}_${cvAttachment.filename}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("cvs")
        .upload(storagePath, bytes, {
          contentType: cvAttachment.mimeType || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      // Try to match job role from subject line
      const { data: roles } = await supabaseAdmin
        .from("job_roles")
        .select("id, title")
        .eq("status", "active");

      let matchedRoleId: string | null = null;
      if (roles) {
        const subjectLower = subject.toLowerCase();
        for (const role of roles) {
          if (subjectLower.includes(role.title.toLowerCase())) {
            matchedRoleId = role.id;
            break;
          }
        }
      }

      // Insert candidate
      const { data: candidate, error: insertError } = await supabaseAdmin
        .from("candidates")
        .insert({
          name: candidateName,
          email: candidateEmail,
          gmail_message_id: msg.id,
          email_subject: subject,
          cv_storage_path: storagePath,
          job_role_id: matchedRoleId,
          status: matchedRoleId ? "pending" : "unmatched",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        continue;
      }

      results.push(candidate);
      ingested++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        ingested,
        skipped,
        total_messages: messages.length,
        candidates: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fetch Gmail CVs error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch CVs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
