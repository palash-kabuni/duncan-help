import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const CONTAINER_NAME = "duncanstorage01";
const NDA_TEMPLATE_PATH = "templates/nda_template.docx";

interface NDARequest {
  submitter_email: string;
  receiving_party_name: string;
  receiving_party_entity: string;
  date_of_agreement: string;
  registered_address: string;
  purpose: string;
  recipient_name: string;
  recipient_email: string;
  internal_signer_name?: string;
  internal_signer_email?: string;
  submission_id?: string;
}

function formatDateLondon(isoDate: string): string {
  const date = new Date(isoDate + "T12:00:00Z");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  return formatter.format(date);
}

function parseConnectionString(connStr: string): { accountName: string; accountKey: string } {
  const parts: Record<string, string> = {};
  for (const part of connStr.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) parts[part.slice(0, idx)] = part.slice(idx + 1);
  }
  if (!parts.AccountName || !parts.AccountKey) throw new Error("Invalid Azure Storage connection string");
  return { accountName: parts.AccountName, accountKey: parts.AccountKey };
}

async function createSharedKeySignature(
  accountName: string,
  accountKey: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  queryParams?: URLSearchParams
): Promise<string> {
  const contentLength = headers["Content-Length"] || "";
  const contentType = headers["Content-Type"] || "";

  const msHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase().startsWith("x-ms-")) msHeaders[k.toLowerCase()] = v;
  }
  const canonicalizedHeaders = Object.keys(msHeaders).sort().map((k) => `${k}:${msHeaders[k]}`).join("\n");

  let canonicalizedResource = `/${accountName}${path}`;
  if (queryParams) {
    const sortedParams = [...queryParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [key, value] of sortedParams) {
      canonicalizedResource += `\n${key}:${value}`;
    }
  }

  const stringToSign = [
    method, "", "", contentLength, "", contentType, "", "", "", "", "", "",
    canonicalizedHeaders, canonicalizedResource,
  ].join("\n");

  const keyBytes = Uint8Array.from(atob(accountKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(stringToSign));
  return `SharedKey ${accountName}:${btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))}`;
}

async function azureRequest(
  accountName: string, accountKey: string, method: string, path: string,
  options: { queryParams?: URLSearchParams; body?: Uint8Array | string; contentType?: string; additionalHeaders?: Record<string, string> } = {}
): Promise<Response> {
  const now = new Date().toUTCString();
  const headers: Record<string, string> = { "x-ms-date": now, "x-ms-version": "2023-11-03", ...(options.additionalHeaders || {}) };

  if (options.body) {
    const bodyLength = typeof options.body === "string" ? new TextEncoder().encode(options.body).length : options.body.length;
    headers["Content-Length"] = String(bodyLength);
    if (options.contentType) headers["Content-Type"] = options.contentType;
  }

  headers["Authorization"] = await createSharedKeySignature(accountName, accountKey, method, path, headers, options.queryParams);

  let url = `https://${accountName}.blob.core.windows.net${path}`;
  if (options.queryParams?.toString()) url += `?${options.queryParams.toString()}`;

  return fetch(url, { method, headers, body: options.body || undefined });
}

/**
 * Generate a simple text-based NDA document with placeholders replaced.
 * Since we can't manipulate DOCX without a library in Deno, we generate
 * a well-formatted plain text NDA document.
 */
function generateNdaContent(data: NDARequest, formattedDate: string): string {
  const internalSigner = data.internal_signer_name || "Palash Soundarkar";
  
  return `NON-DISCLOSURE AGREEMENT

Date of Agreement: ${formattedDate}

BETWEEN:

(1) Kabuni Ltd ("Disclosing Party")

AND

(2) ${data.receiving_party_entity} ("Receiving Party")
    Registered Address: ${data.registered_address}

PURPOSE: ${data.purpose}

---

1. DEFINITIONS AND INTERPRETATION

1.1 In this Agreement, "Confidential Information" means all information disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, or by any other means, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure.

2. OBLIGATIONS OF THE RECEIVING PARTY

2.1 The Receiving Party shall keep the Confidential Information confidential and shall not disclose it to any third party without the prior written consent of the Disclosing Party.

2.2 The Receiving Party shall use the Confidential Information solely for the Purpose stated above.

2.3 The Receiving Party shall protect the Confidential Information using the same degree of care that it uses to protect its own confidential information, but in no event less than reasonable care.

3. EXCEPTIONS

3.1 The obligations in clause 2 shall not apply to information that:
(a) is or becomes publicly available through no fault of the Receiving Party;
(b) was already known to the Receiving Party prior to disclosure;
(c) is independently developed by the Receiving Party; or
(d) is required to be disclosed by law or regulation.

4. TERM AND TERMINATION

4.1 This Agreement shall remain in effect for a period of two (2) years from the Date of Agreement.

4.2 The obligations of confidentiality shall survive termination of this Agreement for a period of five (5) years.

5. GOVERNING LAW

5.1 This Agreement shall be governed by and construed in accordance with the laws of England and Wales.

---

SIGNED:

For and on behalf of Kabuni Ltd:

Name: ${internalSigner}
Title: Authorised Signatory
Date: _______________
Signature: _______________


For and on behalf of ${data.receiving_party_entity}:

Name: ${data.recipient_name}
Title: _______________
Date: _______________
Signature: _______________
`;
}

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

async function createNotionRow(
  data: NDARequest, docUrl: string, notionToken: string, formattedDate: string
): Promise<{ pageId: string; pageUrl: string }> {
  const notionDbId = Deno.env.get("NOTION_NDA_DB_ID");
  if (!notionDbId) throw new Error("NOTION_NDA_DB_ID not configured");

  const properties: Record<string, any> = {
    "Name": { title: [{ text: { content: `NDA - ${data.receiving_party_name}` } }] },
    "Date of Agreement": { date: { start: data.date_of_agreement } },
    "Receiving Party Legal Entity Name": { rich_text: [{ text: { content: data.receiving_party_entity } }] },
    "Registered Address": { rich_text: [{ text: { content: data.registered_address } }] },
    "Purpose": { rich_text: [{ text: { content: data.purpose } }] },
    "Doc URL": { url: docUrl },
    "Submitted By": { email: data.submitter_email },
    "Recipient Email": { email: data.recipient_email },
    "Signature Status": { checkbox: false },
    "DocuSign Envelope ID": { rich_text: [{ text: { content: "" } }] },
    "Signature Audit URL": { url: null },
  };

  const res = await fetch(`${NOTION_API_URL}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: notionDbId }, properties }),
  });

  if (!res.ok) throw new Error(`Failed to create Notion row: ${await res.text()}`);
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.recipient_email)) {
      return new Response(JSON.stringify({ error: "Invalid recipient email format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateCheck = new Date(body.date_of_agreement);
    if (isNaN(dateCheck.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const submitterEmail = body.submitter_email || user.email || "unknown";

    // Idempotency check
    let submissionId = body.submission_id;
    if (submissionId) {
      const { data: existing } = await supabaseAdmin
        .from("nda_submissions")
        .select("id, google_doc_id, notion_page_id, status")
        .eq("id", submissionId)
        .single();

      if (existing && existing.google_doc_id && existing.notion_page_id) {
        return new Response(JSON.stringify({
          success: true,
          submission_id: existing.id,
          document_url: existing.google_doc_url || existing.google_doc_id,
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
      // Parse Azure credentials
      const connectionString = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
      if (!connectionString) throw new Error("Azure Storage not configured");
      const { accountName, accountKey } = parseConnectionString(connectionString);

      // Generate NDA content
      const ndaContent = generateNdaContent(body, formattedDate);
      const ndaBytes = new TextEncoder().encode(ndaContent);

      // Upload NDA to Azure Blob Storage
      const sanitizedName = body.receiving_party_name.replace(/[^a-zA-Z0-9_\- ]/g, "_");
      const dateStr = body.date_of_agreement.replace(/-/g, "_");
      const blobPath = `ndas/${sanitizedName}/NDA_${dateStr}.txt`;

      const uploadRes = await azureRequest(accountName, accountKey, "PUT", `/${CONTAINER_NAME}/${blobPath}`, {
        body: ndaBytes,
        contentType: "text/plain; charset=utf-8",
        additionalHeaders: { "x-ms-blob-type": "BlockBlob" },
      });

      if (!uploadRes.ok) throw new Error(`Failed to upload NDA: ${await uploadRes.text()}`);

      const docUrl = `https://${accountName}.blob.core.windows.net/${CONTAINER_NAME}/${blobPath}`;

      // Create Notion row
      const notionToken = await getNotionToken(supabaseAdmin);
      const { pageId: notionPageId, pageUrl: notionPageUrl } = await createNotionRow(
        { ...body, submitter_email: submitterEmail },
        docUrl,
        notionToken,
        formattedDate
      );

      // Update submission record — store blob path in google_doc_id field for backward compatibility
      await supabaseAdmin
        .from("nda_submissions")
        .update({
          google_doc_id: blobPath,
          google_doc_url: docUrl,
          notion_page_id: notionPageId,
          notion_page_url: notionPageUrl,
          status: "generated",
          last_error: null,
        })
        .eq("id", submissionId);

      console.log(`NDA generated successfully: blob=${blobPath}, notion=${notionPageId}`);

      return new Response(JSON.stringify({
        success: true,
        submission_id: submissionId,
        document_url: docUrl,
        blob_path: blobPath,
        notion_page_id: notionPageId,
        notion_page_url: notionPageUrl,
        status: "generated",
        message: `NDA for ${body.receiving_party_name} generated successfully. Document stored in Azure Blob Storage and logged in Notion.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (genError) {
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
