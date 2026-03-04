import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { BlobServiceClient } from "https://esm.sh/@azure/storage-blob@12.26.0";

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

function getContainerClient(connectionString: string) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  return blobServiceClient.getContainerClient(CONTAINER_NAME);
}

async function downloadBlobBytes(connectionString: string, blobPath: string): Promise<Uint8Array> {
  const containerClient = getContainerClient(connectionString);
  const blobClient = containerClient.getBlobClient(blobPath);

  const downloadRes = await blobClient.download(0);
  if (!downloadRes.readableStreamBody) {
    throw new Error(`Failed to download blob stream: ${blobPath}`);
  }

  const arrayBuffer = await new Response(downloadRes.readableStreamBody).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function uploadBlobBytes(
  connectionString: string,
  blobPath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const containerClient = getContainerClient(connectionString);
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  await blockBlobClient.uploadData(bytes, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

/**
 * Download the Word template from Azure, replace placeholders, and return the modified docx bytes.
 * 
 * Word/OOXML stores text in <w:t> elements inside <w:r> (run) elements.
 * Placeholders like {{Purpose}} may be split across multiple runs by Word.
 * We handle this by concatenating all text in each paragraph, performing replacements,
 * then reconstructing the runs.
 */
async function generateDocxFromTemplate(
  connectionString: string,
  data: NDARequest,
  formattedDate: string
): Promise<Uint8Array> {
  // 1. Download the template
  let templateBytes: Uint8Array;
  try {
    templateBytes = await downloadBlobBytes(connectionString, NDA_TEMPLATE_PATH);
  } catch (error) {
    throw new Error(
      `Failed to download NDA template from ${NDA_TEMPLATE_PATH}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  console.log(`Downloaded template: ${templateBytes.length} bytes`);

  // 2. Open with JSZip
  const zip = await JSZip.loadAsync(templateBytes);

  // 3. Read word/document.xml
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("Template is not a valid .docx — missing word/document.xml");

  let docXml = await docXmlFile.async("string");

  // 4. Build placeholder map
  const internalSigner = data.internal_signer_name || "Palash Soundarkar";
  const internalSignerEmail = data.internal_signer_email || "palash@kabuni.com";

  const replacements: Record<string, string> = {
    // Template uses underscore-style placeholders
    "{{Receiving_Party_Legal_Entity_Name}}": data.receiving_party_entity,
    "{{Date_of_Agreement}}": formattedDate,
    "{{Registered_Address_of_Receiving_Party_Legal_Entity}}": data.registered_address,
    "{{Purpose}}": data.purpose,
    "{{Recipient_Name_for_Signature}}": data.recipient_name,
    "{{Recipient_Email}}": data.recipient_email,
    "{{Internal_Signer_Name}}": internalSigner,
    "{{Internal_Signer_Email}}": internalSignerEmail,
    "{{Submitter_Email}}": data.submitter_email,
    // Also handle alternate styles (camelCase, spaces)
    "{{ReceivingPartyName}}": data.receiving_party_name,
    "{{ReceivingPartyEntity}}": data.receiving_party_entity,
    "{{DateOfAgreement}}": formattedDate,
    "{{RegisteredAddress}}": data.registered_address,
    "{{RecipientName}}": data.recipient_name,
    "{{RecipientEmail}}": data.recipient_email,
    "{{InternalSignerName}}": internalSigner,
    "{{InternalSignerEmail}}": internalSignerEmail,
    "{{SubmitterEmail}}": data.submitter_email,
    "{{Receiving Party Name}}": data.receiving_party_name,
    "{{Receiving Party Entity}}": data.receiving_party_entity,
    "{{Date of Agreement}}": formattedDate,
    "{{Registered Address}}": data.registered_address,
    "{{Recipient Name}}": data.recipient_name,
    "{{Recipient Email}}": data.recipient_email,
    "{{Internal Signer Name}}": internalSigner,
    "{{Internal Signer Email}}": internalSignerEmail,
    "{{Submitter Email}}": data.submitter_email,
  };

  // 5. Handle Word splitting placeholders across XML runs.
  // First, try to clean up split placeholders by removing XML tags between {{ and }}
  // This regex finds {{ followed by any mix of text and XML tags until }}
  docXml = docXml.replace(
    /\{\{((?:[^}]|\}(?!\}))*?)\}\}/g,
    (match) => {
      // Strip all XML tags from inside the placeholder to get the clean key
      const cleanKey = match.replace(/<[^>]+>/g, "");
      return cleanKey;
    }
  );

  // 6. Now do simple string replacements
  for (const [placeholder, value] of Object.entries(replacements)) {
    // Escape XML special characters in the replacement value
    const xmlSafe = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
    
    docXml = docXml.split(placeholder).join(xmlSafe);
  }

  // 7. Write back and generate
  zip.file("word/document.xml", docXml);

  // Also check headers and footers for placeholders
  const headerFooterFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("word/header") || name.startsWith("word/footer")
  );
  for (const hfFile of headerFooterFiles) {
    let hfXml = await zip.file(hfFile)!.async("string");
    // Clean split placeholders
    hfXml = hfXml.replace(
      /\{\{((?:[^}]|\}(?!\}))*?)\}\}/g,
      (match) => match.replace(/<[^>]+>/g, "")
    );
    for (const [placeholder, value] of Object.entries(replacements)) {
      const xmlSafe = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
      hfXml = hfXml.split(placeholder).join(xmlSafe);
    }
    zip.file(hfFile, hfXml);
  }

  const outputBytes = await zip.generateAsync({ type: "uint8array" });
  console.log(`Generated .docx: ${outputBytes.length} bytes`);
  return outputBytes;
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
      const connectionString = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
      if (!connectionString) throw new Error("Azure Storage not configured");

      // Generate .docx from template
      const docxBytes = await generateDocxFromTemplate(connectionString, body, formattedDate);

      // Upload NDA to Azure Blob Storage as .docx
      const sanitizedName = body.receiving_party_name.replace(/[^a-zA-Z0-9_\- ]/g, "_");
      const dateStr = body.date_of_agreement.replace(/-/g, "_");
      const blobPath = `ndas/${sanitizedName}/NDA_${dateStr}.docx`;

      const docUrl = await uploadBlobBytes(
        connectionString,
        blobPath,
        docxBytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      // Create Notion row
      const notionToken = await getNotionToken(supabaseAdmin);
      const { pageId: notionPageId, pageUrl: notionPageUrl } = await createNotionRow(
        { ...body, submitter_email: submitterEmail },
        docUrl,
        notionToken,
        formattedDate
      );

      // Update submission record
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
        message: `NDA for ${body.receiving_party_name} generated successfully as Word document. Stored in Azure Blob Storage and logged in Notion.`,
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
