import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";

async function getAccessToken(supabaseAdmin: any): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.log("Google credentials not configured");
    return null;
  }

  const { data: tokenData, error } = await supabaseAdmin
    .from("google_drive_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !tokenData) {
    console.log("No Drive tokens found");
    return null;
  }

  // Check if token needs refresh
  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry <= new Date()) {
    console.log("Token expired, refreshing...");
    
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

    if (!refreshResponse.ok) {
      console.error("Failed to refresh token");
      return null;
    }

    const newTokens = await refreshResponse.json();
    const newExpiry = new Date(Date.now() + (newTokens.expires_in * 1000));
    
    await supabaseAdmin
      .from("google_drive_tokens")
      .update({
        access_token: newTokens.access_token,
        token_expiry: newExpiry.toISOString(),
      })
      .eq("id", tokenData.id);

    return newTokens.access_token;
  }

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const accessToken = await getAccessToken(supabaseAdmin);

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Google Drive not connected. An admin needs to connect it first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, ...params } = await req.json();

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let result: any;

    switch (action) {
      case "search": {
        // Search for files by query
        const query = params.query || "";
        const mimeTypes = params.mimeTypes || [];
        
        let q = `fullText contains '${query.replace(/'/g, "\\'")}'`;
        
        if (mimeTypes.length > 0) {
          const mimeQueries = mimeTypes.map((m: string) => `mimeType='${m}'`).join(" or ");
          q = `(${q}) and (${mimeQueries})`;
        }
        
        // Exclude trashed files
        q += " and trashed=false";

        const url = new URL(`${GOOGLE_DRIVE_API}/files`);
        url.searchParams.set("q", q);
        url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size,owners)");
        url.searchParams.set("pageSize", String(params.limit || 20));
        url.searchParams.set("orderBy", "modifiedTime desc");

        const response = await fetch(url.toString(), { headers });
        if (!response.ok) {
          throw new Error(`Search failed: ${await response.text()}`);
        }
        result = await response.json();
        break;
      }

      case "list": {
        // List files, optionally in a folder
        const folderId = params.folderId || "root";
        let q = `'${folderId}' in parents and trashed=false`;

        const url = new URL(`${GOOGLE_DRIVE_API}/files`);
        url.searchParams.set("q", q);
        url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)");
        url.searchParams.set("pageSize", String(params.limit || 50));
        url.searchParams.set("orderBy", "folder,name");

        const response = await fetch(url.toString(), { headers });
        if (!response.ok) {
          throw new Error(`List failed: ${await response.text()}`);
        }
        result = await response.json();
        break;
      }

      case "get_content": {
        // Get file content (for Google Docs, Sheets, etc.)
        const fileId = params.fileId;
        if (!fileId) {
          throw new Error("fileId is required");
        }

        // First get file metadata to determine type
        const metaResponse = await fetch(
          `${GOOGLE_DRIVE_API}/files/${fileId}?fields=id,name,mimeType`,
          { headers }
        );
        if (!metaResponse.ok) {
          throw new Error(`Failed to get file metadata: ${await metaResponse.text()}`);
        }
        const meta = await metaResponse.json();

        let content: string;
        
        // Handle different file types
        if (meta.mimeType === "application/vnd.google-apps.document") {
          // Export Google Doc as plain text
          const exportResponse = await fetch(
            `${GOOGLE_DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
            { headers }
          );
          if (!exportResponse.ok) {
            throw new Error(`Export failed: ${await exportResponse.text()}`);
          }
          content = await exportResponse.text();
        } else if (meta.mimeType === "application/vnd.google-apps.spreadsheet") {
          // Export Google Sheet as CSV
          const exportResponse = await fetch(
            `${GOOGLE_DRIVE_API}/files/${fileId}/export?mimeType=text/csv`,
            { headers }
          );
          if (!exportResponse.ok) {
            throw new Error(`Export failed: ${await exportResponse.text()}`);
          }
          content = await exportResponse.text();
        } else if (meta.mimeType === "application/vnd.google-apps.presentation") {
          // Export Google Slides as plain text
          const exportResponse = await fetch(
            `${GOOGLE_DRIVE_API}/files/${fileId}/export?mimeType=text/plain`,
            { headers }
          );
          if (!exportResponse.ok) {
            throw new Error(`Export failed: ${await exportResponse.text()}`);
          }
          content = await exportResponse.text();
        } else if (meta.mimeType === "application/pdf") {
          // For PDFs, we can't easily extract text without a library
          content = "[PDF file - text extraction not available. Use webViewLink to view.]";
        } else if (meta.mimeType.startsWith("text/") || meta.mimeType === "application/json") {
          // Download text files directly
          const downloadResponse = await fetch(
            `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`,
            { headers }
          );
          if (!downloadResponse.ok) {
            throw new Error(`Download failed: ${await downloadResponse.text()}`);
          }
          content = await downloadResponse.text();
        } else if (meta.mimeType.startsWith("image/")) {
          content = "[Image file - use webViewLink to view.]";
        } else {
          content = `[File type ${meta.mimeType} - content extraction not supported. Use webViewLink to view.]`;
        }

        result = {
          id: meta.id,
          name: meta.name,
          mimeType: meta.mimeType,
          content: content.slice(0, 50000), // Limit content size
        };
        break;
      }

      case "check_connection": {
        // Just verify the connection works
        const url = new URL(`${GOOGLE_DRIVE_API}/about`);
        url.searchParams.set("fields", "user(displayName,emailAddress)");
        
        const response = await fetch(url.toString(), { headers });
        if (!response.ok) {
          throw new Error(`Connection check failed: ${await response.text()}`);
        }
        result = await response.json();
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Drive API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Drive API error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
