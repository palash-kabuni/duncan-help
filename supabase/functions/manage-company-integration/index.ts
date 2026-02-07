import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to verify identity
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

    // Use service role to check admin status
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { integration_id, api_key, action } = await req.json();

    if (!integration_id) {
      return new Response(JSON.stringify({ error: "integration_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      // Delete company integration
      const { error: deleteError } = await supabaseAdmin
        .from("company_integrations")
        .delete()
        .eq("integration_id", integration_id);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true, message: "Integration disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connect or update integration
    if (!api_key) {
      return new Response(JSON.stringify({ error: "api_key is required for connecting" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple encryption (in production, use proper encryption)
    const encryptedKey = btoa(api_key);

    const { data, error: upsertError } = await supabaseAdmin
      .from("company_integrations")
      .upsert(
        {
          integration_id,
          encrypted_api_key: encryptedKey,
          status: "connected",
          updated_by: user.id,
          last_sync: new Date().toISOString(),
        },
        { onConflict: "integration_id" }
      )
      .select()
      .single();

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true, integration: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error managing company integration:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
