import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/**
 * Create a JWT for DocuSign authentication
 */
async function getDocuSignAccessToken(): Promise<string> {
  const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY");
  const userId = Deno.env.get("DOCUSIGN_USER_ID");
  const privateKeyPem = Deno.env.get("DOCUSIGN_PRIVATE_KEY");

  if (!integrationKey || !userId || !privateKeyPem) {
    throw new Error("DocuSign credentials not configured (DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY)");
  }

  const basePath = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net";
  const authServer = basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com";

  // Build JWT
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: authServer,
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  };

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import RSA private key and sign
  const pemClean = privateKeyPem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemClean), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${sigB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(`https://${authServer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`DocuSign token exchange failed: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

/**
 * Get Drive access token
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

  if (error || !tokenData) throw new Error("Google Drive not connected");

  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry > new Date()) return tokenData.access_token;

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
 * Get Notion token
 */
async function getNotionToken(supabaseAdmin: any): Promise<string> {
  const { data: integration } = await supabaseAdmin
    .from("company_integrations")
    .select("encrypted_api_key, status")
    .eq("integration_id", "notion")
    .single();

  if (!integration || integration.status !== "connected" || !integration.encrypted_api_key) {
    throw new Error("Notion not connected");
  }
  return atob(integration.encrypted_api_key);
}

/**
 * Update a Notion page's properties
 */
async function updateNotionPage(pageId: string, properties: Record<string, any>, notionToken: string): Promise<void> {
  const res = await fetch(`${NOTION_API_URL}/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update Notion page: ${errText}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authenticated admin user
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

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submission_id, dry_run } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get submission
    const { data: submission, error: subErr } = await supabaseAdmin
      .from("nda_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: already has an envelope?
    if (submission.docusign_envelope_id) {
      return new Response(JSON.stringify({
        success: true,
        envelope_id: submission.docusign_envelope_id,
        message: "Envelope already created for this submission.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!submission.google_doc_id) {
      return new Response(JSON.stringify({ error: "NDA document not generated yet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status
    await supabaseAdmin
      .from("nda_submissions")
      .update({ status: "sending_signature", last_error: null })
      .eq("id", submission_id);

    try {
      // Step 1: Export doc as PDF
      const driveToken = await getDriveAccessToken(supabaseAdmin);
      const pdfRes = await fetch(
        `${GOOGLE_DRIVE_API}/files/${submission.google_doc_id}/export?mimeType=application/pdf`,
        { headers: { Authorization: `Bearer ${driveToken}` } }
      );
      if (!pdfRes.ok) throw new Error(`PDF export failed: ${await pdfRes.text()}`);

      const pdfBuffer = await pdfRes.arrayBuffer();
      const pdfBytes = new Uint8Array(pdfBuffer);
      let binary = "";
      for (let i = 0; i < pdfBytes.length; i++) {
        binary += String.fromCharCode(pdfBytes[i]);
      }
      const pdfBase64 = btoa(binary);

      // Dry run mode
      if (dry_run) {
        await supabaseAdmin
          .from("nda_submissions")
          .update({ status: "generated", last_error: "Dry run — envelope not sent" })
          .eq("id", submission_id);

        return new Response(JSON.stringify({
          success: true,
          dry_run: true,
          message: `Dry run complete. PDF exported (${pdfBytes.length} bytes). Would send to: signer1=${submission.internal_signer_email || "palash@kabuni.com"}, signer2=${submission.recipient_email}`,
          pdf_size_bytes: pdfBytes.length,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Step 2: Get DocuSign access token
      const dsAccessToken = await getDocuSignAccessToken();
      const accountId = Deno.env.get("DOCUSIGN_ACCOUNT_ID");
      const basePath = Deno.env.get("DOCUSIGN_BASE_PATH") || "https://demo.docusign.net";

      if (!accountId) throw new Error("DOCUSIGN_ACCOUNT_ID not configured");

      const kabSigner = {
        email: submission.internal_signer_email || "palash@kabuni.com",
        name: submission.internal_signer_name || "Palash Soundarkar",
        recipientId: "1",
        routingOrder: "1",
        tabs: {
          signHereTabs: [{ documentId: "1", pageNumber: "1", anchorString: "/sig1/", anchorUnits: "pixels" }],
        },
      };

      const recipientSigner = {
        email: submission.recipient_email,
        name: submission.recipient_name,
        recipientId: "2",
        routingOrder: "2",
        tabs: {
          signHereTabs: [{ documentId: "1", pageNumber: "1", anchorString: "/sig2/", anchorUnits: "pixels" }],
        },
      };

      // Step 3: Create envelope
      const envelopeBody = {
        emailSubject: `NDA - ${submission.receiving_party_name} — Please sign`,
        documents: [
          {
            documentBase64: pdfBase64,
            name: `NDA - ${submission.receiving_party_name}.pdf`,
            fileExtension: "pdf",
            documentId: "1",
          },
        ],
        recipients: {
          signers: [kabSigner, recipientSigner],
        },
        status: "sent",
      };

      const envelopeRes = await fetch(
        `${basePath}/restapi/v2.1/accounts/${accountId}/envelopes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${dsAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(envelopeBody),
        }
      );

      if (!envelopeRes.ok) {
        const errText = await envelopeRes.text();
        throw new Error(`DocuSign envelope creation failed: ${errText}`);
      }

      const envelope = await envelopeRes.json();
      const envelopeId = envelope.envelopeId;
      console.log(`DocuSign envelope created: ${envelopeId}`);

      // Step 4: Update submission
      await supabaseAdmin
        .from("nda_submissions")
        .update({
          docusign_envelope_id: envelopeId,
          status: "sent",
          last_error: null,
        })
        .eq("id", submission_id);

      // Step 5: Update Notion
      if (submission.notion_page_id) {
        try {
          const notionToken = await getNotionToken(supabaseAdmin);
          await updateNotionPage(submission.notion_page_id, {
            "Signature Status": { checkbox: true },
            "DocuSign Envelope ID": {
              rich_text: [{ text: { content: envelopeId } }],
            },
          }, notionToken);
        } catch (notionErr) {
          console.error("Non-critical: Failed to update Notion:", notionErr);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        envelope_id: envelopeId,
        submission_id,
        message: `NDA sent for signature. Envelope ID: ${envelopeId}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (sendError) {
      await supabaseAdmin
        .from("nda_submissions")
        .update({
          status: "failed",
          last_error: sendError instanceof Error ? sendError.message : "Unknown error",
        })
        .eq("id", submission_id);

      throw sendError;
    }
  } catch (e) {
    console.error("nda-send-signature error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
