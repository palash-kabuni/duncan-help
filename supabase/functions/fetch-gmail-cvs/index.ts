import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AZURE_CONTAINER = "duncanstorage01";
const AZURE_CV_FOLDER = "cvs";

function parseAzureConnectionString(connStr: string): { accountName: string; accountKey: string } {
  const parts: Record<string, string> = {};
  for (const part of connStr.trim().split(";")) {
    const seg = part.trim();
    if (!seg) continue;
    const idx = seg.indexOf("=");
    if (idx > 0) parts[seg.slice(0, idx).trim()] = seg.slice(idx + 1).trim();
  }
  if (!parts.AccountName || !parts.AccountKey) throw new Error("Invalid Azure connection string");
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

async function uploadToAzureBlob(
  accountName: string,
  accountKey: string,
  blobPath: string,
  data: Uint8Array,
  contentType: string
): Promise<string> {
  const now = new Date().toUTCString();
  const fullPath = `/${AZURE_CONTAINER}/${blobPath}`;
  const headers: Record<string, string> = {
    "x-ms-date": now,
    "x-ms-version": "2023-11-03",
    "x-ms-blob-type": "BlockBlob",
    "Content-Length": String(data.length),
    "Content-Type": contentType,
  };

  const msHeaders = Object.entries(headers)
    .filter(([k]) => k.toLowerCase().startsWith("x-ms-"))
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([k, v]) => `${k.toLowerCase()}:${v}`)
    .join("\n");

  const stringToSign = [
    "PUT", "", "", String(data.length), "", contentType,
    "", "", "", "", "", "",
    msHeaders,
    `/${accountName}${fullPath}`,
  ].join("\n");

  const keyBytes = Uint8Array.from(atob(accountKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(stringToSign));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  headers["Authorization"] = `SharedKey ${accountName}:${signature}`;

  const url = `https://${accountName}.blob.core.windows.net${fullPath}`;
  const res = await fetch(url, { method: "PUT", headers, body: data });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure upload failed (${res.status}): ${errText}`);
  }
  return url;
}

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

    return { token: newTokens.access_token, email: tokenData.email_address || "" };
  }

  return { token: tokenData.access_token, email: tokenData.email_address || "" };
}

function candidateNameFromFilename(filename: string): string {
  // "John_Doe_CV.pdf" → "John Doe CV", "resume-jane-smith.docx" → "resume jane smith"
  return filename
    .replace(/\.(pdf|docx?|rtf)$/i, "")
    .replace(/[_\-\.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSenderEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

interface CvAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
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

    // Parse optional role_id from request body
    let filterRoleId: string | null = null;
    try {
      const body = await req.json();
      filterRoleId = body?.role_id || null;
    } catch {
      // no body — fetch all roles
    }

    // Fetch active job roles to build subject-based search
    let roleQuery = supabaseAdmin
      .from("job_roles")
      .select("id, title")
      .eq("status", "active");

    if (filterRoleId) {
      roleQuery = roleQuery.eq("id", filterRoleId);
    }

    const { data: activeRoles } = await roleQuery;

    if (!activeRoles || activeRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active job roles found. Create job roles first so Duncan can match CVs by subject line." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Gmail query: emails with attachments whose subject contains any role title
    const subjectClauses = activeRoles.map((r: any) => `subject:"${r.title}"`).join(" OR ");
    const query = `has:attachment (filename:pdf OR filename:docx OR filename:doc) (${subjectClauses})`;
    console.log("Gmail search query:", query);

    const searchUrl = new URL(`${GMAIL_API}/messages`);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("maxResults", "50");

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
      // Fetch full message
      const msgRes = await fetch(`${GMAIL_API}/messages/${msg.id}?format=full`, { headers });
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      // Extract headers
      const msgHeaders = msgData.payload?.headers || [];
      const subject = msgHeaders.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
      const from = msgHeaders.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
      const senderEmail = extractSenderEmail(from);

      // Match job role from subject line
      let matchedRoleId: string | null = null;
      const subjectLower = subject.toLowerCase();
      for (const role of activeRoles) {
        if (subjectLower.includes(role.title.toLowerCase())) {
          matchedRoleId = role.id;
          break;
        }
      }

      // Collect ALL CV attachments from the email (not just the first one)
      const cvAttachments: CvAttachment[] = [];
      function isCvFile(name: string): boolean {
        const lower = name.toLowerCase();
        // Match .pdf, .docx, .doc — including double extensions like abc.docx.pdf
        return /\.(pdf|docx?)(\.pdf)?$/i.test(lower);
      }
      function collectAttachments(parts: any[]) {
        for (const part of parts) {
          const filename = (part.filename || "").toLowerCase();
          if (part.body?.attachmentId && isCvFile(filename)) {
            cvAttachments.push({
              attachmentId: part.body.attachmentId,
              filename: part.filename,
              mimeType: part.mimeType,
            });
          }
          // Recurse into nested parts (multipart messages)
          if (part.parts) {
            collectAttachments(part.parts);
          }
        }
      }
      collectAttachments(msgData.payload?.parts || []);

      if (cvAttachments.length === 0) {
        skipped++;
        continue;
      }

      // Process each CV attachment as a separate candidate
      for (const cv of cvAttachments) {
        // Dedup by gmail_message_id + original filename (storage path has timestamp prefix)
        const { data: existing } = await supabaseAdmin
          .from("candidates")
          .select("id")
          .eq("gmail_message_id", msg.id)
          .like("cv_storage_path", `%_${cv.filename}`)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Download attachment
        const attachRes = await fetch(
          `${GMAIL_API}/messages/${msg.id}/attachments/${cv.attachmentId}`,
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
        const storagePath = `${Date.now()}_${cv.filename}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("cvs")
          .upload(storagePath, bytes, {
            contentType: cv.mimeType || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        // Also upload to Azure Blob Storage (non-blocking, best-effort)
        try {
          const azureConnStr = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
          if (azureConnStr) {
            const { accountName, accountKey } = parseAzureConnectionString(azureConnStr);
            const azureBlobPath = `${AZURE_CV_FOLDER}/${storagePath}`;
            const azureUrl = await uploadToAzureBlob(
              accountName, accountKey, azureBlobPath, bytes,
              cv.mimeType || "application/octet-stream"
            );
            console.log(`CV also uploaded to Azure: ${azureUrl}`);
          }
        } catch (azureErr) {
          console.warn("Azure Blob upload failed (non-blocking):", azureErr);
        }

        // Use filename as temporary candidate name
        const candidateName = candidateNameFromFilename(cv.filename);

        // Insert candidate — one per CV attachment
        const { data: candidate, error: insertError } = await supabaseAdmin
          .from("candidates")
          .insert({
            name: candidateName,
            email: senderEmail,
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

        // Parse CV with AI to extract real candidate name & email
        try {
          const parseRes = await fetch(
            `${supabaseUrl}/functions/v1/parse-cv`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                candidate_id: candidate.id,
                storage_path: storagePath,
              }),
            }
          );
          if (parseRes.ok) {
            const parseData = await parseRes.json();
            if (parseData.parsed_name) {
              candidate.name = parseData.parsed_name;
            }
            if (parseData.parsed_email) {
              candidate.email = parseData.parsed_email;
            }
            console.log(`Parsed CV for ${candidate.id}: name=${parseData.parsed_name}, email=${parseData.parsed_email}`);
          } else {
            console.warn(`CV parse returned ${parseRes.status} for candidate ${candidate.id}`);
          }
        } catch (parseErr) {
          console.warn("CV parse failed (non-blocking):", parseErr);
        }

        results.push(candidate);
        ingested++;
      }
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
