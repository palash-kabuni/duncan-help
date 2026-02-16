import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DOCS_API = "https://docs.googleapis.com/v1/documents";
const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const TEMPLATE_DOC_ID = "1n-cZHKUi638q1VlkZdVVRg2z2bVtJqJaMzj7FeSPN9g";
const ROOT_FOLDER_NAME = "Kabuni NDAs";

/**
 * Find or create the root NDA folder in the user's Drive (at top level).
 * Since drive.file scope only sees files created/opened by the app,
 * we manage our own root folder instead of relying on a pre-existing one.
 */
async function getOrCreateRootFolder(accessToken: string): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  // Search for existing root folder created by this app
  const q = `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = new URL(`${GOOGLE_DRIVE_API}/files`);
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("fields", "files(id,name)");

  const searchRes = await fetch(searchUrl.toString(), { headers });
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      console.log(`Found existing root NDA folder: ${data.files[0].id}`);
      return data.files[0].id;
    }
  }

  // Create root folder at Drive top level
  const createRes = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: ROOT_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) throw new Error(`Failed to create root NDA folder: ${await createRes.text()}`);
  const folder = await createRes.json();
  console.log(`Created root NDA folder: ${folder.id}`);
  return folder.id;
}

interface NDARequest {
  submitter_email: string;
  receiving_party_name: string;
  receiving_party_entity: string;
  date_of_agreement: string; // ISO date string
  registered_address: string;
  purpose: string;
  recipient_name: string;
  recipient_email: string;
  internal_signer_name?: string;
  internal_signer_email?: string;
  submission_id?: string; // For idempotency — if provided, reuse existing record
}

/**
 * Format date as "d MMMM yyyy" in Europe/London timezone
 */
function formatDateLondon(isoDate: string): string {
  const date = new Date(isoDate + "T12:00:00Z"); // noon UTC to avoid timezone edge issues
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  return formatter.format(date);
}

/**
 * Get a valid Google Drive access token, refreshing if needed.
 */
async function getDriveAccessToken(supabaseAdmin: any): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const { data: tokenData, error } = await supabaseAdmin
    .from("google_drive_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !tokenData) throw new Error("Google Drive not connected. An admin must connect it first.");

  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry > new Date()) return tokenData.access_token;

  // Refresh token
  const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshResponse.ok) throw new Error("Failed to refresh Google Drive token");

  const newTokens = await refreshResponse.json();
  const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000);

  await supabaseAdmin
    .from("google_drive_tokens")
    .update({ access_token: newTokens.access_token, token_expiry: newExpiry.toISOString() })
    .eq("id", tokenData.id);

  return newTokens.access_token;
}

/**
 * Get Notion token from company_integrations
 */
async function getNotionToken(supabaseAdmin: any): Promise<string> {
  const { data: integration } = await supabaseAdmin
    .from("company_integrations")
    .select("encrypted_api_key, status")
    .eq("integration_id", "notion")
    .single();

  if (!integration || integration.status !== "connected" || !integration.encrypted_api_key) {
    throw new Error("Notion is not connected. An admin must connect it first.");
  }
  return atob(integration.encrypted_api_key);
}

/**
 * Find or create a subfolder in Google Drive
 */
async function findOrCreateSubfolder(
  parentFolderId: string,
  folderName: string,
  accessToken: string
): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  // Search for existing folder
  const q = `'${parentFolderId}' in parents and name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = new URL(`${GOOGLE_DRIVE_API}/files`);
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("fields", "files(id,name)");

  const searchRes = await fetch(searchUrl.toString(), { headers });
  if (!searchRes.ok) throw new Error(`Drive folder search failed: ${await searchRes.text()}`);
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    console.log(`Found existing subfolder: ${searchData.files[0].id}`);
    return searchData.files[0].id;
  }

  // Create new folder
  const createRes = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });
  if (!createRes.ok) throw new Error(`Failed to create subfolder: ${await createRes.text()}`);
  const newFolder = await createRes.json();
  console.log(`Created subfolder: ${newFolder.id}`);
  return newFolder.id;
}

/**
 * Copy the template doc into the target folder
 */
async function copyTemplate(
  templateDocId: string,
  targetFolderId: string,
  docName: string,
  accessToken: string
): Promise<{ id: string; url: string }> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const copyRes = await fetch(`${GOOGLE_DRIVE_API}/files/${templateDocId}/copy`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: docName,
      parents: [targetFolderId],
    }),
  });
  if (!copyRes.ok) throw new Error(`Failed to copy template: ${await copyRes.text()}`);
  const copied = await copyRes.json();

  return {
    id: copied.id,
    url: `https://docs.google.com/document/d/${copied.id}/edit`,
  };
}

/**
 * Replace placeholders in the Google Doc and bold specific values
 */
async function replacePlaceholders(
  docId: string,
  replacements: Record<string, string>,
  boldKeys: string[],
  accessToken: string
): Promise<void> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  // First, do all replacements
  const requests: any[] = [];
  for (const [placeholder, value] of Object.entries(replacements)) {
    requests.push({
      replaceAllText: {
        containsText: { text: `{{${placeholder}}}`, matchCase: true },
        replaceText: value,
      },
    });
  }

  if (requests.length === 0) return;

  const batchRes = await fetch(`${GOOGLE_DOCS_API}/${docId}:batchUpdate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ requests }),
  });

  if (!batchRes.ok) {
    const errText = await batchRes.text();
    // Check for placeholder not found
    if (errText.includes("not found")) {
      throw new Error(`Placeholder replacement failed — some placeholders may be missing from the template: ${errText}`);
    }
    throw new Error(`Failed to replace placeholders: ${errText}`);
  }

  // Now bold specific inserted values
  if (boldKeys.length > 0) {
    // Read the document to find text positions
    const docRes = await fetch(`${GOOGLE_DOCS_API}/${docId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!docRes.ok) return; // Non-critical if bolding fails
    const doc = await docRes.json();

    const boldRequests: any[] = [];
    const bodyContent = doc.body?.content || [];

    for (const key of boldKeys) {
      const searchText = replacements[key];
      if (!searchText) continue;

      // Find all occurrences of the text in the document
      for (const element of bodyContent) {
        if (element.paragraph) {
          for (const elem of element.paragraph.elements || []) {
            const textRun = elem.textRun;
            if (textRun && textRun.content?.includes(searchText)) {
              const startIdx = elem.startIndex + textRun.content.indexOf(searchText);
              const endIdx = startIdx + searchText.length;
              boldRequests.push({
                updateTextStyle: {
                  range: { startIndex: startIdx, endIndex: endIdx },
                  textStyle: { bold: true },
                  fields: "bold",
                },
              });
            }
          }
        }
      }
    }

    if (boldRequests.length > 0) {
      await fetch(`${GOOGLE_DOCS_API}/${docId}:batchUpdate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ requests: boldRequests }),
      });
    }
  }
}

/**
 * Share a Google Drive file with a user (writer role)
 */
async function shareFileWithUser(
  fileId: string,
  email: string,
  accessToken: string
): Promise<void> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const res = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}/permissions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "user",
      role: "writer",
      emailAddress: email,
      sendNotificationEmail: true,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Failed to share file with ${email}: ${errText}`);
    // Non-critical — don't throw, just log
  } else {
    console.log(`Shared file ${fileId} with ${email}`);
  }
}

/**
 * Export Google Doc as PDF and return base64 content
 */
async function exportAsPdf(docId: string, accessToken: string): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const exportRes = await fetch(
    `${GOOGLE_DRIVE_API}/files/${docId}/export?mimeType=application/pdf`,
    { headers }
  );
  if (!exportRes.ok) throw new Error(`PDF export failed: ${await exportRes.text()}`);

  const arrayBuffer = await exportRes.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Create a row in the Notion NDA database
 */
async function createNotionRow(
  data: NDARequest,
  docUrl: string,
  notionToken: string,
  formattedDate: string
): Promise<{ pageId: string; pageUrl: string }> {
  const notionDbId = Deno.env.get("NOTION_NDA_DB_ID");
  if (!notionDbId) throw new Error("NOTION_NDA_DB_ID not configured");

  const properties: Record<string, any> = {
    "Name": {
      title: [{ text: { content: `NDA - ${data.receiving_party_name}` } }],
    },
    "Date of Agreement": {
      date: { start: data.date_of_agreement },
    },
    "Receiving Party Legal Entity Name": {
      rich_text: [{ text: { content: data.receiving_party_entity } }],
    },
    "Registered Address": {
      rich_text: [{ text: { content: data.registered_address } }],
    },
    "Purpose": {
      rich_text: [{ text: { content: data.purpose } }],
    },
    "Doc URL": {
      url: docUrl,
    },
    "Submitted By": {
      email: data.submitter_email,
    },
    "Recipient Email": {
      email: data.recipient_email,
    },
    "Send for Signature": {
      checkbox: false,
    },
    "Signature Status": {
      checkbox: false,
    },
    "DocuSign Envelope ID": {
      rich_text: [{ text: { content: "" } }],
    },
    "Signature Audit URL": {
      url: null,
    },
  };

  const res = await fetch(`${NOTION_API_URL}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: notionDbId },
      properties,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Notion row: ${errText}`);
  }

  const page = await res.json();
  return { pageId: page.id, pageUrl: page.url };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: NDARequest = await req.json();

    // Validate required fields
    const required: (keyof NDARequest)[] = [
      "receiving_party_name", "receiving_party_entity", "date_of_agreement",
      "registered_address", "purpose", "recipient_name", "recipient_email",
    ];
    for (const field of required) {
      if (!body[field]) {
        return new Response(JSON.stringify({ error: `Missing required field: ${field}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.recipient_email)) {
      return new Response(JSON.stringify({ error: "Invalid recipient email format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate date format
    const dateCheck = new Date(body.date_of_agreement);
    if (isNaN(dateCheck.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const submitterEmail = body.submitter_email || user.email || "unknown";

    // Idempotency: check if submission already exists
    let submissionId = body.submission_id;
    if (submissionId) {
      const { data: existing } = await supabaseAdmin
        .from("nda_submissions")
        .select("id, google_doc_id, notion_page_id, status")
        .eq("id", submissionId)
        .single();

      if (existing && existing.google_doc_id && existing.notion_page_id) {
        console.log("Idempotent hit — returning existing submission");
        return new Response(JSON.stringify({
          success: true,
          submission_id: existing.id,
          google_doc_url: `https://docs.google.com/document/d/${existing.google_doc_id}/edit`,
          notion_page_id: existing.notion_page_id,
          status: existing.status,
          message: "NDA was already generated.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Create submission record
    if (!submissionId) {
      const { data: newSub, error: insertErr } = await supabaseAdmin
        .from("nda_submissions")
        .insert({
          submitter_id: user.id,
          submitter_email: submitterEmail,
          receiving_party_name: body.receiving_party_name,
          receiving_party_entity: body.receiving_party_entity,
          date_of_agreement: body.date_of_agreement,
          registered_address: body.registered_address,
          purpose: body.purpose,
          recipient_name: body.recipient_name,
          recipient_email: body.recipient_email,
          internal_signer_name: body.internal_signer_name || "Palash Soundarkar",
          internal_signer_email: body.internal_signer_email || "palash@kabuni.com",
          status: "generating",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Failed to create submission: ${insertErr.message}`);
      submissionId = newSub.id;
    } else {
      await supabaseAdmin
        .from("nda_submissions")
        .update({ status: "generating", last_error: null })
        .eq("id", submissionId);
    }

    const formattedDate = formatDateLondon(body.date_of_agreement);

    try {
      // Step 1: Get Drive access token
      const accessToken = await getDriveAccessToken(supabaseAdmin);

      // Step 2: Get or create root NDA folder, then find/create subfolder
      const rootFolderId = await getOrCreateRootFolder(accessToken);
      const subfolderId = await findOrCreateSubfolder(rootFolderId, body.receiving_party_name, accessToken);

      // Step 3: Copy template
      const docName = `NDA - ${body.receiving_party_name}`;
      const { id: docId, url: docUrl } = await copyTemplate(TEMPLATE_DOC_ID, subfolderId, docName, accessToken);

      // Step 4: Replace placeholders
      const replacements: Record<string, string> = {
        "Receiving_Party_Legal_Entity_Name": body.receiving_party_entity,
        "Date_of_Agreement": formattedDate,
        "Registered_Address_of_Receiving_Party_Legal_Entity": body.registered_address,
        "Purpose": body.purpose,
        "Recipient_Name_for_Signature": body.recipient_name,
      };
      await replacePlaceholders(docId, replacements, ["Receiving_Party_Legal_Entity_Name", "Date_of_Agreement"], accessToken);

      // Step 4b: Share the doc with the submitter so they can access it
      await shareFileWithUser(docId, submitterEmail, accessToken);
      // Also share the subfolder so they can browse it
      await shareFileWithUser(subfolderId, submitterEmail, accessToken);

      // Step 5: Export as PDF (store base64 for DocuSign later)
      const pdfBase64 = await exportAsPdf(docId, accessToken);

      // Step 6: Create Notion row
      const notionToken = await getNotionToken(supabaseAdmin);
      const { pageId: notionPageId, pageUrl: notionPageUrl } = await createNotionRow(
        { ...body, submitter_email: submitterEmail },
        docUrl,
        notionToken,
        formattedDate
      );

      // Step 7: Update submission record
      await supabaseAdmin
        .from("nda_submissions")
        .update({
          google_doc_id: docId,
          google_doc_url: docUrl,
          notion_page_id: notionPageId,
          notion_page_url: notionPageUrl,
          status: "generated",
          last_error: null,
        })
        .eq("id", submissionId);

      console.log(`NDA generated successfully: doc=${docId}, notion=${notionPageId}`);

      return new Response(JSON.stringify({
        success: true,
        submission_id: submissionId,
        google_doc_id: docId,
        google_doc_url: docUrl,
        notion_page_id: notionPageId,
        notion_page_url: notionPageUrl,
        status: "generated",
        message: `NDA for ${body.receiving_party_name} generated successfully. Document created in Google Drive and logged in Notion.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (genError) {
      // Update submission with error
      await supabaseAdmin
        .from("nda_submissions")
        .update({
          status: "failed",
          last_error: genError instanceof Error ? genError.message : "Unknown error",
        })
        .eq("id", submissionId);

      throw genError;
    }
  } catch (e) {
    console.error("nda-generate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
