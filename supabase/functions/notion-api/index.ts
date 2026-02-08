import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is authenticated
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

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Notion token from company_integrations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from("company_integrations")
      .select("encrypted_api_key, status")
      .eq("integration_id", "notion")
      .single();

    if (integrationError || !integration) {
      console.error("Notion integration not found:", integrationError);
      return new Response(JSON.stringify({ error: "Notion not connected" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (integration.status !== "connected") {
      return new Response(JSON.stringify({ error: "Notion integration is not active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode the base64 encoded token
    const notionToken = atob(integration.encrypted_api_key);
    
    // Parse request body
    const { action, params } = await req.json();
    console.log("Notion API action:", action, "params:", JSON.stringify(params));

    let notionResponse;
    
    switch (action) {
      case "search": {
        // Search across all pages and databases
        notionResponse = await fetch(`${NOTION_API_URL}/search`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionToken}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: params?.query || "",
            filter: params?.filter,
            sort: params?.sort,
            page_size: params?.page_size || 10,
            start_cursor: params?.start_cursor,
          }),
        });
        break;
      }

      case "get_page": {
        if (!params?.page_id) {
          return new Response(JSON.stringify({ error: "page_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        notionResponse = await fetch(`${NOTION_API_URL}/pages/${params.page_id}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${notionToken}`,
            "Notion-Version": NOTION_VERSION,
          },
        });
        break;
      }

      case "get_database": {
        if (!params?.database_id) {
          return new Response(JSON.stringify({ error: "database_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        notionResponse = await fetch(`${NOTION_API_URL}/databases/${params.database_id}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${notionToken}`,
            "Notion-Version": NOTION_VERSION,
          },
        });
        break;
      }

      case "query_database": {
        if (!params?.database_id) {
          return new Response(JSON.stringify({ error: "database_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        notionResponse = await fetch(`${NOTION_API_URL}/databases/${params.database_id}/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionToken}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filter: params?.filter,
            sorts: params?.sorts,
            page_size: params?.page_size || 100,
            start_cursor: params?.start_cursor,
          }),
        });
        break;
      }

      case "get_block_children": {
        if (!params?.block_id) {
          return new Response(JSON.stringify({ error: "block_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const pageSize = params?.page_size || 100;
        const startCursor = params?.start_cursor ? `&start_cursor=${params.start_cursor}` : "";
        notionResponse = await fetch(
          `${NOTION_API_URL}/blocks/${params.block_id}/children?page_size=${pageSize}${startCursor}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${notionToken}`,
              "Notion-Version": NOTION_VERSION,
            },
          }
        );
        break;
      }

      case "list_databases": {
        // Search for databases only
        notionResponse = await fetch(`${NOTION_API_URL}/search`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionToken}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filter: { property: "object", value: "database" },
            page_size: params?.page_size || 100,
            start_cursor: params?.start_cursor,
          }),
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error("Notion API error:", notionResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "Notion API error", 
          status: notionResponse.status,
          details: errorText 
        }),
        {
          status: notionResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await notionResponse.json();
    console.log("Notion API success, results count:", data.results?.length || 1);

    // Update last_sync timestamp
    await supabaseAdmin
      .from("company_integrations")
      .update({ last_sync: new Date().toISOString() })
      .eq("integration_id", "notion");

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in notion-api:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
