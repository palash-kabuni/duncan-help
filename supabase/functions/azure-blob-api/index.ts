import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Azure REST helpers ───

function parseConnectionString(connStr: string) {
  const parts: Record<string, string> = {};
  for (const seg of connStr.split(";")) {
    const idx = seg.indexOf("=");
    if (idx > 0) parts[seg.slice(0, idx)] = seg.slice(idx + 1);
  }
  return {
    accountName: parts["AccountName"],
    accountKey: parts["AccountKey"],
    endpoint: `https://${parts["AccountName"]}.blob.core.windows.net`,
  };
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

function base64Decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function base64Encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function azureSign(
  accountName: string,
  accountKey: string,
  method: string,
  url: URL,
  headers: Record<string, string>,
  contentLength: number | "" = "",
): Promise<string> {
  // Canonicalized headers: lowercase, sorted, trimmed, one per line
  const xmsHeaders = Object.keys(headers)
    .filter((k) => k.toLowerCase().startsWith("x-ms-"))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((k) => `${k.toLowerCase()}:${headers[k].trim()}`)
    .join("\n");

  // Canonicalized resource
  let canonResource = `/${accountName}${decodeURIComponent(url.pathname)}`;
  const params = [...url.searchParams.entries()].sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));
  for (const [k, v] of params) canonResource += `\n${k.toLowerCase()}:${v}`;

  const contentType = headers["Content-Type"] || "";
  // For GET/HEAD/DELETE, content-length must be empty string (not "0")
  const clStr = (method === "GET" || method === "HEAD" || method === "DELETE")
    ? ""
    : (contentLength === "" ? "" : String(contentLength));

  const stringToSign = [
    method,                          // verb
    "",                              // Content-Encoding
    "",                              // Content-Language
    clStr,                           // Content-Length
    "",                              // Content-MD5
    contentType,                     // Content-Type
    "",                              // Date
    "",                              // If-Modified-Since
    "",                              // If-Match
    "",                              // If-None-Match
    "",                              // If-Unmodified-Since
    "",                              // Range
    xmsHeaders,                      // CanonicalizedHeaders
    canonResource,                   // CanonicalizedResource
  ].join("\n");

  const keyBytes = base64Decode(accountKey);
  const sig = await hmacSha256(keyBytes.buffer, stringToSign);
  return `SharedKey ${accountName}:${base64Encode(sig)}`;
}

const API_VERSION = "2023-11-03";

function xmsDate(): string {
  return new Date().toUTCString();
}

async function azureFetch(
  accountName: string,
  accountKey: string,
  endpoint: string,
  method: string,
  path: string,
  queryParams: Record<string, string> = {},
  body?: Uint8Array | null,
  extraHeaders: Record<string, string> = {},
) {
  const url = new URL(`${endpoint}${path}`);
  for (const [k, v] of Object.entries(queryParams)) url.searchParams.set(k, v);

  const date = xmsDate();
  const headers: Record<string, string> = {
    "x-ms-date": date,
    "x-ms-version": API_VERSION,
    ...extraHeaders,
  };

  const contentLength = body ? body.byteLength : "";
  const auth = await azureSign(accountName, accountKey, method, url, headers, contentLength);
  headers["Authorization"] = auth;
  if (body) headers["Content-Length"] = String(body.byteLength);

  const resp = await fetch(url.toString(), {
    method,
    headers,
    body: body ?? undefined,
  });
  return resp;
}

// ─── Actions ───

interface BlobItem {
  name: string;
  url: string;
  size: number;
  lastModified: string;
}

async function listBlobs(
  accountName: string,
  accountKey: string,
  endpoint: string,
  container: string,
  prefix?: string,
): Promise<BlobItem[]> {
  const params: Record<string, string> = {
    restype: "container",
    comp: "list",
  };
  if (prefix) params["prefix"] = prefix;

  const resp = await azureFetch(accountName, accountKey, endpoint, "GET", `/${container}`, params);
  if (!resp.ok) throw new Error(`List failed (${resp.status}): ${await resp.text()}`);

  const xml = await resp.text();
  const items: BlobItem[] = [];

  // Simple XML parsing for blob list
  const blobRegex = /<Blob>([\s\S]*?)<\/Blob>/g;
  let match;
  while ((match = blobRegex.exec(xml)) !== null) {
    const blob = match[1];
    const name = blob.match(/<Name>(.*?)<\/Name>/)?.[1] || "";
    const size = parseInt(blob.match(/<Content-Length>(\d+)<\/Content-Length>/)?.[1] || "0");
    const lastModified = blob.match(/<Last-Modified>(.*?)<\/Last-Modified>/)?.[1] || "";

    items.push({
      name,
      url: `${endpoint}/${container}/${name}`,
      size,
      lastModified,
    });
  }

  return items;
}

async function searchBlobs(
  accountName: string,
  accountKey: string,
  endpoint: string,
  container: string,
  query: string,
): Promise<BlobItem[]> {
  // List all blobs and filter by name match
  const all = await listBlobs(accountName, accountKey, endpoint, container);
  const q = query.toLowerCase();
  return all.filter((b) => b.name.toLowerCase().includes(q));
}

async function uploadBlob(
  accountName: string,
  accountKey: string,
  endpoint: string,
  container: string,
  blobPath: string,
  data: Uint8Array,
  contentType: string,
): Promise<{ url: string; blob_path: string }> {
  const fullPath = `/${container}/${blobPath}`;
  const extraHeaders: Record<string, string> = {
    "x-ms-blob-type": "BlockBlob",
    "Content-Type": contentType,
  };

  const resp = await azureFetch(
    accountName,
    accountKey,
    endpoint,
    "PUT",
    fullPath,
    {},
    data,
    extraHeaders,
  );

  if (!resp.ok) throw new Error(`Upload failed (${resp.status}): ${await resp.text()}`);

  return {
    url: `${endpoint}${fullPath}`,
    blob_path: blobPath,
  };
}

async function getBlobContent(
  accountName: string,
  accountKey: string,
  endpoint: string,
  container: string,
  blobPath: string,
): Promise<{ content: string; contentType: string; name: string }> {
  const fullPath = `/${container}/${blobPath}`;
  const resp = await azureFetch(accountName, accountKey, endpoint, "GET", fullPath);

  if (!resp.ok) throw new Error(`Get content failed (${resp.status}): ${await resp.text()}`);

  const ct = resp.headers.get("Content-Type") || "application/octet-stream";
  const name = blobPath.split("/").pop() || blobPath;

  let content: string;
  if (
    ct.startsWith("text/") ||
    ct.includes("json") ||
    ct.includes("xml") ||
    ct.includes("csv")
  ) {
    content = await resp.text();
  } else if (ct.includes("pdf") || ct.includes("image/")) {
    content = `[Binary file (${ct}) — use the blob URL to access directly.]`;
  } else {
    // Try reading as text, truncate if too large
    try {
      content = await resp.text();
      if (content.length > 50000) content = content.slice(0, 50000) + "\n[truncated]";
    } catch {
      content = `[Binary file (${ct}) — content extraction not supported.]`;
    }
  }

  return { content, contentType: ct, name };
}

// ─── Main handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Azure credentials
    const connStr = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
    if (!connStr) {
      return new Response(
        JSON.stringify({ error: "Azure Storage not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { accountName, accountKey, endpoint } = parseConnectionString(connStr);

    // Determine content type to decide how to parse body
    const ct = req.headers.get("Content-Type") || "";

    // Handle multipart upload
    if (ct.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const container = (formData.get("container") as string) || "documents";
      const path = (formData.get("path") as string) || "";

      if (!file) throw new Error("No file provided");

      const blobPath = path ? `${path}/${file.name}` : file.name;
      const fileBytes = new Uint8Array(await file.arrayBuffer());

      const result = await uploadBlob(
        accountName,
        accountKey,
        endpoint,
        container,
        blobPath,
        fileBytes,
        file.type || "application/octet-stream",
      );

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // JSON actions
    const { action, ...params } = await req.json();
    let result: unknown;

    switch (action) {
      case "list": {
        result = await listBlobs(
          accountName,
          accountKey,
          endpoint,
          params.container || "documents",
          params.path,
        );
        break;
      }

      case "search": {
        result = await searchBlobs(
          accountName,
          accountKey,
          endpoint,
          params.container || "documents",
          params.query || "",
        );
        break;
      }

      case "get_content": {
        if (!params.blob_path) throw new Error("blob_path is required");
        result = await getBlobContent(
          accountName,
          accountKey,
          endpoint,
          params.container || "documents",
          params.blob_path,
        );
        break;
      }

      case "upload_blob": {
        // JSON-based upload (for programmatic use, e.g., NDA generation)
        if (!params.blob_path || !params.content_base64) {
          throw new Error("blob_path and content_base64 are required");
        }
        const bytes = base64Decode(params.content_base64);
        result = await uploadBlob(
          accountName,
          accountKey,
          endpoint,
          params.container || "ndas",
          params.blob_path,
          bytes,
          params.content_type || "application/octet-stream",
        );
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Azure Blob API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Azure Blob API error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
