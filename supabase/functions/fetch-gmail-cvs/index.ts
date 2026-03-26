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

// --- Normalization & matching ---
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter(Boolean);
}

function matchRoleToSubject(
  subject: string,
  roles: { id: string; title: string }[]
): { roleId: string; confidence: "exact" | "high" | "low" } | null {
  const normalizedSubject = normalizeText(subject);
  const subjectTokens = tokenize(subject);

  // Pass 1: Exact normalized match (subject contains the full normalized title)
  const exactMatches = roles.filter((r) => normalizedSubject.includes(normalizeText(r.title)));

  if (exactMatches.length === 1) {
    return { roleId: exactMatches[0].id, confidence: "exact" };
  }

  if (exactMatches.length > 1) {
    exactMatches.sort((a, b) => b.title.length - a.title.length);
    return { roleId: exactMatches[0].id, confidence: "high" };
  }

  // Pass 2: Word-based matching
  const wordMatches: { role: typeof roles[0]; matchedWords: number; totalWords: number }[] = [];
  for (const role of roles) {
    const titleTokens = tokenize(role.title);
    if (titleTokens.length === 0) continue;
    const matched = titleTokens.filter((t) => subjectTokens.includes(t));
    if (matched.length === titleTokens.length) {
      wordMatches.push({ role, matchedWords: matched.length, totalWords: titleTokens.length });
    }
  }

  if (wordMatches.length === 1) {
    return { roleId: wordMatches[0].role.id, confidence: "high" };
  }
  if (wordMatches.length > 1) {
    wordMatches.sort((a, b) => b.totalWords - a.totalWords);
    return { roleId: wordMatches[0].role.id, confidence: "high" };
  }

  return null;
}

// --- Validation helpers ---
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

const GENERIC_FILENAMES = new Set([
  "resume", "cv", "curriculum vitae", "file", "document", "doc", "untitled",
  "my resume", "my cv", "cover letter", "application",
]);

function isGenericName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[0-9\s_\-\.]+/g, " ").trim();
  if (normalized.length < 3) return true;
  if (/^\d+$/.test(normalized)) return true;
  for (const g of GENERIC_FILENAMES) {
    if (normalized === g || normalized.startsWith(g + " ")) return true;
  }
  return false;
}

function candidateNameFromFilename(filename: string): string {
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

interface ProcessingDetail {
  gmail_message_id: string;
  filename: string;
  outcome: "ingested" | "skipped" | "unmatched" | "parse_failed" | "upload_failed" | "reprocessed" | "duplicate_email";
  reason?: string;
  candidate_id?: string;
  role_title?: string;
  confidence?: string;
}

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

    const { error: tokenUpdateError } = await supabaseAdmin
      .from("gmail_tokens")
      .update({
        access_token: newTokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq("id", tokenData.id);

    if (tokenUpdateError) {
      console.error("Failed to persist refreshed Gmail token:", tokenUpdateError);
    }

    return { token: newTokens.access_token, email: tokenData.email_address || "" };
  }

  return { token: tokenData.access_token, email: tokenData.email_address || "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
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

    const gmailHeaders = { Authorization: `Bearer ${credentials.token}` };

    let filterRoleId: string | null = null;
    try {
      const body = await req.json();
      filterRoleId = body?.role_id || null;
    } catch {
      // no body
    }

    // Fetch active job roles for matching
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
        JSON.stringify({ error: "No active job roles found. Create job roles first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // BROADER FETCH: search for all emails with CV-like attachments, not just subject matches
    const query = `has:attachment (filename:pdf OR filename:docx OR filename:doc)`;
    console.log("Gmail search query:", query);

    const searchUrl = new URL(`${GMAIL_API}/messages`);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("maxResults", "50");

    const searchRes = await fetch(searchUrl.toString(), { headers: gmailHeaders });
    if (!searchRes.ok) {
      throw new Error(`Gmail search failed: ${await searchRes.text()}`);
    }

    const searchData = await searchRes.json();
    const messages = searchData.messages || [];

    let ingested = 0;
    let skipped = 0;
    let unmatched = 0;
    let parseFailed = 0;
    const results: any[] = [];
    const details: ProcessingDetail[] = [];

    for (const msg of messages) {
      const msgRes = await fetch(`${GMAIL_API}/messages/${msg.id}?format=full`, { headers: gmailHeaders });
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      const msgHeaders = msgData.payload?.headers || [];
      const subject = msgHeaders.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";

      // Role matching with confidence enforcement
      const roleMatch = matchRoleToSubject(subject, activeRoles);
      // Only assign role on exact or high confidence
      const matchedRoleId = (roleMatch && (roleMatch.confidence === "exact" || roleMatch.confidence === "high"))
        ? roleMatch.roleId
        : null;
      const matchedRoleTitle = matchedRoleId
        ? activeRoles.find((r: any) => r.id === matchedRoleId)?.title || null
        : null;

      // Collect CV attachments
      const cvAttachments: CvAttachment[] = [];
      function isCvFile(name: string): boolean {
        return /\.(pdf|docx?)(\.pdf)?$/i.test(name.toLowerCase());
      }
      function collectAttachments(parts: any[]) {
        for (const part of parts) {
          if (part.body?.attachmentId && isCvFile(part.filename || "")) {
            cvAttachments.push({
              attachmentId: part.body.attachmentId,
              filename: part.filename,
              mimeType: part.mimeType,
            });
          }
          if (part.parts) collectAttachments(part.parts);
        }
      }
      collectAttachments(msgData.payload?.parts || []);

      if (cvAttachments.length === 0) continue;

      for (const cv of cvAttachments) {
        // --- DEDUP LAYER 1: exact gmail_message_id + exact filename ---
        const { data: existingByMsg } = await supabaseAdmin
          .from("candidates")
          .select("id, status, email, job_role_id")
          .eq("gmail_message_id", msg.id)
          .eq("cv_storage_path", "") // we'll also check exact storage path below
          .maybeSingle();

        // Check by exact storage path suffix (the filename part)
        const { data: existingExact } = await supabaseAdmin
          .from("candidates")
          .select("id, status, email, job_role_id, failure_reason")
          .eq("gmail_message_id", msg.id)
          .filter("cv_storage_path", "ilike", `%_${cv.filename}`)
          .maybeSingle();

        // NON-DESTRUCTIVE RETRY: if parse_failed, reprocess in place
        if (existingExact) {
          if (existingExact.status === "parse_failed") {
            console.log(`Reprocessing parse_failed candidate ${existingExact.id} in place`);
            // Reset for reprocessing — don't delete
            const { error: resetErr } = await supabaseAdmin
              .from("candidates")
              .update({
                status: matchedRoleId ? "pending" : "unmatched",
                job_role_id: matchedRoleId,
                failure_reason: null,
                name: candidateNameFromFilename(cv.filename),
                email: null,
                competency_score: null,
                values_score: null,
                total_score: null,
              })
              .eq("id", existingExact.id);

            if (resetErr) {
              console.error(`Failed to reset candidate ${existingExact.id}:`, resetErr);
              details.push({ gmail_message_id: msg.id, filename: cv.filename, outcome: "parse_failed", reason: "Reset failed" });
              parseFailed++;
              continue;
            }

            // Re-trigger parse
            await triggerParse(supabaseUrl, supabaseServiceKey, existingExact.id, existingExact.id);
            details.push({
              gmail_message_id: msg.id, filename: cv.filename,
              outcome: "reprocessed", candidate_id: existingExact.id,
              role_title: matchedRoleTitle || undefined,
            });
            ingested++;
            continue;
          }

          // Already processed successfully
          skipped++;
          details.push({
            gmail_message_id: msg.id, filename: cv.filename,
            outcome: "skipped", reason: `Already exists with status ${existingExact.status}`,
            candidate_id: existingExact.id,
          });
          continue;
        }

        // Download attachment
        const attachRes = await fetch(
          `${GMAIL_API}/messages/${msg.id}/attachments/${cv.attachmentId}`,
          { headers: gmailHeaders }
        );
        if (!attachRes.ok) {
          console.error(`Failed to download attachment ${cv.attachmentId} from message ${msg.id}`);
          details.push({ gmail_message_id: msg.id, filename: cv.filename, outcome: "parse_failed", reason: "Attachment download failed" });
          parseFailed++;
          continue;
        }
        const attachData = await attachRes.json();

        const base64Data = attachData.data.replace(/-/g, "+").replace(/_/g, "/");
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Upload to Supabase storage
        const storagePath = `${Date.now()}_${cv.filename}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("cvs")
          .upload(storagePath, bytes, {
            contentType: cv.mimeType || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          console.error(`Storage upload failed for ${cv.filename}:`, uploadError);
          await supabaseAdmin.from("candidates").insert({
            name: candidateNameFromFilename(cv.filename),
            gmail_message_id: msg.id,
            email_subject: subject,
            job_role_id: matchedRoleId,
            cv_storage_path: storagePath,
            status: "parse_failed",
            failure_reason: `Storage upload failed: ${uploadError.message || "unknown"}`,
          });
          details.push({ gmail_message_id: msg.id, filename: cv.filename, outcome: "upload_failed", reason: uploadError.message });
          parseFailed++;
          continue;
        }

        // Azure Blob upload (best-effort)
        try {
          const azureConnStr = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
          if (azureConnStr) {
            const { accountName, accountKey } = parseAzureConnectionString(azureConnStr);
            const azureBlobPath = `${AZURE_CV_FOLDER}/${storagePath}`;
            await uploadToAzureBlob(accountName, accountKey, azureBlobPath, bytes, cv.mimeType || "application/octet-stream");
          }
        } catch (azureErr) {
          console.warn("Azure Blob upload failed (non-blocking):", azureErr);
        }

        // Determine candidate name — validate it's not generic
        const rawName = candidateNameFromFilename(cv.filename);
        const nameIsGeneric = isGenericName(rawName);

        const candidateStatus = matchedRoleId
          ? (nameIsGeneric ? "pending" : "pending")
          : "unmatched";

        if (!matchedRoleId) unmatched++;

        // Insert candidate — email is always null until parse-cv sets it
        const { data: candidate, error: insertError } = await supabaseAdmin
          .from("candidates")
          .insert({
            name: nameIsGeneric ? `Unparsed (${cv.filename})` : rawName,
            email: null,
            gmail_message_id: msg.id,
            email_subject: subject,
            cv_storage_path: storagePath,
            job_role_id: matchedRoleId,
            status: candidateStatus,
            failure_reason: nameIsGeneric ? "Filename too generic; requires CV parsing" : null,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          details.push({ gmail_message_id: msg.id, filename: cv.filename, outcome: "parse_failed", reason: `Insert failed: ${insertError.message}` });
          parseFailed++;
          continue;
        }

        // Trigger CV parse
        const storedPath = candidate.cv_storage_path;
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
                storage_path: storedPath,
              }),
            }
          );
          if (parseRes.ok) {
            const parseData = await parseRes.json();

            // --- DEDUP LAYER 2: parsed email + job_role_id ---
            if (parseData.parsed_email && matchedRoleId) {
              const { data: emailDup } = await supabaseAdmin
                .from("candidates")
                .select("id")
                .eq("email", parseData.parsed_email)
                .eq("job_role_id", matchedRoleId)
                .neq("id", candidate.id)
                .maybeSingle();

              if (emailDup) {
                console.log(`Duplicate candidate by email+role: ${parseData.parsed_email} for role ${matchedRoleId}. Removing new record.`);
                await supabaseAdmin.from("candidates").delete().eq("id", candidate.id);
                await supabaseAdmin.storage.from("cvs").remove([storedPath]);
                skipped++;
                details.push({
                  gmail_message_id: msg.id, filename: cv.filename,
                  outcome: "duplicate_email",
                  reason: `Duplicate: email ${parseData.parsed_email} already exists for this role`,
                  candidate_id: emailDup.id,
                });
                continue;
              }
            }

            console.log(`Parsed CV for ${candidate.id}: name=${parseData.parsed_name}, email=${parseData.parsed_email}`);
          } else {
            console.warn(`CV parse returned ${parseRes.status} for candidate ${candidate.id}`);
            const { error: pfErr } = await supabaseAdmin
              .from("candidates")
              .update({ status: "parse_failed", failure_reason: `Parse returned HTTP ${parseRes.status}` })
              .eq("id", candidate.id);
            if (pfErr) console.error("Failed to update parse_failed status:", pfErr);
            parseFailed++;
            details.push({ gmail_message_id: msg.id, filename: cv.filename, outcome: "parse_failed", reason: `Parse HTTP ${parseRes.status}`, candidate_id: candidate.id });
            // Don't skip adding to results — still ingested
          }
        } catch (parseErr: any) {
          console.warn("CV parse failed:", parseErr);
          const { error: pfErr } = await supabaseAdmin
            .from("candidates")
            .update({ status: "parse_failed", failure_reason: `Parse exception: ${parseErr.message || "unknown"}` })
            .eq("id", candidate.id);
          if (pfErr) console.error("Failed to update parse_failed status:", pfErr);
          parseFailed++;
          details.push({ gmail_message_id: msg.id, filename: cv.filename, outcome: "parse_failed", reason: parseErr.message, candidate_id: candidate.id });
        }

        results.push(candidate);
        ingested++;
        details.push({
          gmail_message_id: msg.id, filename: cv.filename,
          outcome: matchedRoleId ? "ingested" : "unmatched",
          candidate_id: candidate.id,
          role_title: matchedRoleTitle || undefined,
          confidence: roleMatch?.confidence,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ingested,
        skipped,
        unmatched,
        parse_failed: parseFailed,
        total_messages: messages.length,
        candidates: results,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Fetch Gmail CVs error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch CVs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to trigger parse-cv without blocking on failure
async function triggerParse(supabaseUrl: string, serviceKey: string, candidateId: string, storagePath: string) {
  try {
    // Fetch the actual storage path from the candidate record
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: cand } = await supabaseAdmin.from("candidates").select("cv_storage_path").eq("id", candidateId).single();
    if (!cand?.cv_storage_path) return;

    await fetch(`${supabaseUrl}/functions/v1/parse-cv`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        storage_path: cand.cv_storage_path,
      }),
    });
  } catch (e) {
    console.error(`Failed to trigger parse for ${candidateId}:`, e);
  }
}
