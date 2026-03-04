import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Azure SharedKey helpers (Web Crypto) ----------

function parseConnectionString(connStr: string) {
  const parts: Record<string, string> = {};
  for (const segment of connStr.split(";")) {
    const idx = segment.indexOf("=");
    if (idx > 0) parts[segment.slice(0, idx)] = segment.slice(idx + 1);
  }
  return {
    accountName: parts["AccountName"],
    accountKey: parts["AccountKey"],
    endpoint: `https://${parts["AccountName"]}.blob.core.windows.net`,
  };
}

async function importKey(accountKey: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(accountKey), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(key: CryptoKey, message: string): Promise<string> {
  const enc = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign("HMAC", key, enc);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function azureFetch(
  accountName: string,
  cryptoKey: CryptoKey,
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: Uint8Array | null,
): Promise<Response> {
  const u = new URL(url);
  const now = new Date().toUTCString();

  headers["x-ms-date"] = now;
  headers["x-ms-version"] = "2023-11-03";

  // Canonicalized headers
  const canonHeaders = Object.keys(headers)
    .filter((k) => k.startsWith("x-ms-"))
    .sort()
    .map((k) => `${k}:${headers[k]}`)
    .join("\n");

  // Canonicalized resource
  let canonResource = `/${accountName}${u.pathname}`;
  const params = [...u.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, v] of params) canonResource += `\n${k}:${v}`;

  const contentLength = body ? String(body.length) : "";
  const contentType = headers["Content-Type"] || "";

  const stringToSign = [
    method,
    "", // Content-Encoding
    "", // Content-Language
    contentLength, // Content-Length
    "", // Content-MD5
    contentType,
    "", // Date
    "", // If-Modified-Since
    "", // If-Match
    "", // If-None-Match
    "", // If-Unmodified-Since
    "", // Range
    canonHeaders,
    canonResource,
  ].join("\n");

  const signature = await sign(cryptoKey, stringToSign);
  headers["Authorization"] = `SharedKey ${accountName}:${signature}`;

  return fetch(url, { method, headers, body: body ?? undefined });
}

// ---------- Action handlers ----------

interface AzureConfig {
  accountName: string;
  endpoint: string;
  cryptoKey: CryptoKey;
}

async function listBlobs(cfg: AzureConfig, container: string, path?: string) {
  const url = new URL(`${cfg.endpoint}/${container}`);
  url.searchParams.set("restype", "container");
  url.searchParams.set("comp", "list");
  if (path) url.searchParams.set("prefix", path.endsWith("/") ? path : path + "/");

  const resp = await azureFetch(cfg.accountName, cfg.cryptoKey, "GET", url.toString());
  if (!resp.ok) throw new Error(`List failed: ${await resp.text()}`);

  const xml = await resp.text();
  const blobs: any[] = [];
  const blobRegex = /<Blob><Name>(.*?)<\/Name>.*?<Content-Length>(.*?)<\/Content-Length>.*?<Last-Modified>(.*?)<\/Last-Modified>.*?<\/Blob>/gs;
  let match;
  while ((match = blobRegex.exec(xml)) !== null) {
    blobs.push({
      name: match[1],
      url: `${cfg.endpoint}/${container}/${match[1]}`,
      size: parseInt(match[2], 10),
      lastModified: match[3],
    });
  }
  return blobs;
}

async function searchBlobs(cfg: AzureConfig, container: string, query: string) {
  // List all blobs and filter by name
  const all = await listBlobs(cfg, container);
  const q = query.toLowerCase();
  return all.filter((b: any) => b.name.toLowerCase().includes(q));
}

async function uploadBlob(cfg: AzureConfig, container: string, blobPath: string, data: Uint8Array, contentType: string) {
  const url = `${cfg.endpoint}/${container}/${blobPath}`;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "x-ms-blob-type": "BlockBlob",
  };

  const resp = await azureFetch(cfg.accountName, cfg.cryptoKey, "PUT", url, headers, data);
  if (!resp.ok) throw new Error(`Upload failed: ${await resp.text()}`);
  // Consume body
  await resp.text();

  return { url, blob_path: `${container}/${blobPath}` };
}

async function getBlobContent(cfg: AzureConfig, container: string, blobPath: string) {
  const url = `${cfg.endpoint}/${container}/${blobPath}`;
  const resp = await azureFetch(cfg.accountName, cfg.cryptoKey, "GET", url);
  if (!resp.ok) throw new Error(`Download failed: ${await resp.text()}`);

  const ct = resp.headers.get("Content-Type") || "application/octet-stream";

  if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml") || ct.includes("csv")) {
    const text = await resp.text();
    return { content: text.slice(0, 50000), contentType: ct, name: blobPath };
  }

  // For binary files, return metadata only
  await resp.arrayBuffer(); // consume body
  return {
    content: `[Binary file (${ct}) — download via URL to view]`,
    contentType: ct,
    name: blobPath,
    url,
  };
}

// ---------- Main handler ----------

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
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Azure config
    const connStr = Deno.env.get("AZURE_STORAGE_CONNECTION_STRING");
    if (!connStr) {
      return new Response(JSON.stringify({ error: "Azure Storage not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountName, endpoint } = parseConnectionString(connStr);
    const cryptoKey = await importKey(parseConnectionString(connStr).accountKey!);
    const cfg: AzureConfig = { accountName, endpoint, cryptoKey };

    // Handle multipart upload
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const container = (formData.get("container") as string) || "documents";
      const path = (formData.get("path") as string) || file.name;

      if (!file) throw new Error("No file provided");

      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await uploadBlob(cfg, container, path, bytes, file.type || "application/octet-stream");

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // JSON actions
    const { action, ...params } = await req.json();
    let result: any;

    switch (action) {
      case "list":
        result = await listBlobs(cfg, params.container || "documents", params.path);
        break;

      case "search":
        result = await searchBlobs(cfg, params.container || "documents", params.query || "");
        break;

      case "get_content":
        result = await getBlobContent(cfg, params.container || "documents", params.blob_path);
        break;

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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
