import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode, encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AzureCredentials {
  accountName: string;
  accountKey: string;
}

function parseConnectionString(connStr: string): AzureCredentials {
  const parts: Record<string, string> = {};
  for (const part of connStr.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      parts[part.slice(0, idx)] = part.slice(idx + 1);
    }
  }
  return {
    accountName: parts["AccountName"],
    accountKey: parts["AccountKey"],
  };
}

function getCredentials(): AzureCredentials {
  const connStr = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
  if (!connStr) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  return parseConnectionString(connStr);
}

async function createAuthorizationHeader(
  creds: AzureCredentials,
  method: string,
  url: URL,
  headers: Record<string, string>,
  contentLength: number
): Promise<string> {
  const now = new Date().toUTCString();
  headers["x-ms-date"] = now;
  headers["x-ms-version"] = "2023-11-03";

  // Build canonicalized headers
  const msHeaders = Object.keys(headers)
    .filter((k) => k.startsWith("x-ms-"))
    .sort()
    .map((k) => `${k}:${headers[k]}`)
    .join("\n");

  // Build canonicalized resource
  const path = url.pathname;
  let canonResource = `/${creds.accountName}${path}`;
  const params = [...url.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, val] of params) {
    canonResource += `\n${key}:${val}`;
  }

  const contentType = headers["Content-Type"] || headers["content-type"] || "";

  const stringToSign = [
    method,                        // HTTP verb
    "",                            // Content-Encoding
    "",                            // Content-Language
    contentLength > 0 ? String(contentLength) : "", // Content-Length
    "",                            // Content-MD5
    contentType,                   // Content-Type
    "",                            // Date
    "",                            // If-Modified-Since
    "",                            // If-Match
    "",                            // If-None-Match
    "",                            // If-Unmodified-Since
    "",                            // Range
    msHeaders,                     // CanonicalizedHeaders
    canonResource,                 // CanonicalizedResource
  ].join("\n");

  const keyBytes = base64Decode(creds.accountKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(stringToSign));
  const signature = base64Encode(new Uint8Array(sig));

  return `SharedKey ${creds.accountName}:${signature}`;
}

async function azureFetch(
  creds: AzureCredentials,
  method: string,
  path: string,
  queryParams?: Record<string, string>,
  body?: Uint8Array,
  contentType?: string
): Promise<Response> {
  const baseUrl = `https://${creds.accountName}.blob.core.windows.net`;
  const url = new URL(path, baseUrl);
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (body) headers["x-ms-blob-type"] = "BlockBlob";

  const auth = await createAuthorizationHeader(creds, method, url, headers, body?.length || 0);
  headers["Authorization"] = auth;

  return await fetch(url.toString(), {
    method,
    headers,
    body: body || undefined,
  });
}

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");
  return data.claims.sub as string;
}

// Parse XML blob list — lightweight regex-based parser
function parseBlobListXml(xml: string) {
  const blobs: Array<{ name: string; size: number; lastModified: string; contentType: string }> = [];
  const blobRegex = /<Blob>([\s\S]*?)<\/Blob>/g;
  let match;
  while ((match = blobRegex.exec(xml)) !== null) {
    const block = match[1];
    const name = block.match(/<Name>(.*?)<\/Name>/)?.[1] || "";
    const size = parseInt(block.match(/<Content-Length>(.*?)<\/Content-Length>/)?.[1] || "0", 10);
    const lastModified = block.match(/<Last-Modified>(.*?)<\/Last-Modified>/)?.[1] || "";
    const ct = block.match(/<Content-Type>(.*?)<\/Content-Type>/)?.[1] || "";
    blobs.push({ name, size, lastModified, contentType: ct });
  }
  return blobs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await authenticateUser(req);
    const creds = getCredentials();

    const reqContentType = req.headers.get("content-type") || "";

    // Handle multipart upload
    if (reqContentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const container = formData.get("container") as string;
      const path = formData.get("path") as string;

      if (!file || !container || !path) {
        return new Response(
          JSON.stringify({ error: "Missing file, container, or path" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const blobPath = `/${container}/${path}`;

      const resp = await azureFetch(creds, "PUT", blobPath, undefined, data, file.type || "application/octet-stream");
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Upload failed: ${errText}`);
      }

      const url = `https://${creds.accountName}.blob.core.windows.net${blobPath}`;
      return new Response(JSON.stringify({ url, blob_path: path }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle JSON actions
    const { action, container, path, query, blob_path } = await req.json();

    if (!container) {
      return new Response(
        JSON.stringify({ error: "container is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "list": {
        const params: Record<string, string> = { restype: "container", comp: "list" };
        if (path) params["prefix"] = path.endsWith("/") ? path : path + "/";

        const resp = await azureFetch(creds, "GET", `/${container}`, params);
        if (!resp.ok) throw new Error(`List failed: ${await resp.text()}`);

        const xml = await resp.text();
        const blobs = parseBlobListXml(xml);
        const baseUrl = `https://${creds.accountName}.blob.core.windows.net/${container}`;

        const result = blobs.map((b) => ({
          name: b.name,
          url: `${baseUrl}/${b.name}`,
          size: b.size,
          lastModified: b.lastModified,
        }));

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search": {
        if (!query) {
          return new Response(JSON.stringify({ error: "query is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const params: Record<string, string> = { restype: "container", comp: "list" };
        const resp = await azureFetch(creds, "GET", `/${container}`, params);
        if (!resp.ok) throw new Error(`Search failed: ${await resp.text()}`);

        const xml = await resp.text();
        const allBlobs = parseBlobListXml(xml);
        const lowerQuery = query.toLowerCase();
        const baseUrl = `https://${creds.accountName}.blob.core.windows.net/${container}`;

        const result = allBlobs
          .filter((b) => b.name.toLowerCase().includes(lowerQuery))
          .map((b) => ({
            name: b.name,
            url: `${baseUrl}/${b.name}`,
            size: b.size,
            lastModified: b.lastModified,
          }));

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_content": {
        if (!blob_path) {
          return new Response(JSON.stringify({ error: "blob_path is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await azureFetch(creds, "GET", `/${container}/${blob_path}`);
        if (!resp.ok) throw new Error(`Get content failed: ${await resp.text()}`);

        const ct = resp.headers.get("content-type") || "application/octet-stream";
        const fileName = blob_path.split("/").pop() || blob_path;

        if (ct.startsWith("text/") || ct === "application/json" || ct === "application/xml") {
          const text = await resp.text();
          return new Response(
            JSON.stringify({
              name: fileName,
              blob_path,
              content_type: ct,
              content: text.slice(0, 50000),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const buf = await resp.arrayBuffer();
        return new Response(
          JSON.stringify({
            name: fileName,
            blob_path,
            content_type: ct,
            content: `[Binary file (${ct}) — ${buf.byteLength} bytes. Download to view.]`,
            size: buf.byteLength,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Azure Blob API error:", error);
    const status = error.message === "Unauthorized" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: error.message || "Azure Blob API error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
