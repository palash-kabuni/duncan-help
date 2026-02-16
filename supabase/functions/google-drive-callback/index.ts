import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const appUrl = Deno.env.get("APP_URL") || "https://duncan.help";

    if (error) {
      console.error("OAuth error from Google:", error);
      return Response.redirect(`${appUrl}/integrations?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      console.error("Missing code or state");
      return Response.redirect(`${appUrl}/integrations?error=missing_params`);
    }

    // Reuse Google Calendar OAuth credentials
    const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!clientId || !clientSecret) {
      console.error("Missing Google credentials");
      return Response.redirect(`${appUrl}/integrations?error=config_error`);
    }

    // Decode state to get user token
    let userToken: string;
    let stateType: string;
    try {
      const decoded = JSON.parse(atob(state));
      userToken = decoded.token;
      stateType = decoded.type;
    } catch {
      console.error("Failed to decode state");
      return Response.redirect(`${appUrl}/integrations?error=invalid_state`);
    }

    if (stateType !== "google-drive") {
      console.error("Invalid state type");
      return Response.redirect(`${appUrl}/integrations?error=invalid_state`);
    }

    // Verify the admin user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("Failed to verify user:", userError);
      return Response.redirect(`${appUrl}/integrations?error=unauthorized`);
    }

    // Verify admin role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      console.error("User is not admin");
      return Response.redirect(`${appUrl}/integrations?error=admin_required`);
    }

    // Exchange code for tokens
    const redirectUri = `${supabaseUrl}/functions/v1/google-drive-callback`;
    
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return Response.redirect(`${appUrl}/integrations?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log("Successfully exchanged code for Drive tokens");

    // Calculate token expiry
    const expiryDate = new Date(Date.now() + (tokens.expires_in * 1000));

    // Store tokens - company-wide (singleton via unique index)
    // First delete any existing tokens, then insert new ones
    await supabaseAdmin
      .from("google_drive_tokens")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    const { error: insertError } = await supabaseAdmin
      .from("google_drive_tokens")
      .insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiryDate.toISOString(),
        connected_by: user.id,
      });

    if (insertError) {
      console.error("Failed to store tokens:", insertError);
      return Response.redirect(`${appUrl}/integrations?error=storage_failed`);
    }

    // Upsert company_integrations record so the dashboard shows "connected"
    const { error: ciError } = await supabaseAdmin
      .from("company_integrations")
      .upsert(
        {
          integration_id: "google-drive",
          status: "connected",
          updated_by: user.id,
          last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "integration_id" }
      );

    if (ciError) {
      console.warn("Failed to upsert company_integrations for google-drive:", ciError);
      // Non-fatal — tokens are saved, Drive works, just dashboard status won't update
    }

    console.log("Successfully stored Google Drive tokens (connected by admin:", user.id, ")");
    return Response.redirect(`${appUrl}/integrations?success=google_drive`);
  } catch (error) {
    console.error("Callback error:", error);
    const appUrl = Deno.env.get("APP_URL") || "https://duncan.help";
    return Response.redirect(`${appUrl}/integrations?error=unexpected`);
  }
});
