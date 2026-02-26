import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    const appUrl = Deno.env.get("APP_URL") || "https://duncan-help.lovable.app";

    if (error || !code) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/integrations?gmail_error=${error || "no_code"}` },
      });
    }

    const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const redirectUri = `${supabaseUrl}/functions/v1/gmail-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
      const errText = await tokenResponse.text();
      console.error("Token exchange failed:", errText);
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/integrations?gmail_error=token_exchange_failed` },
      });
    }

    const tokens = await tokenResponse.json();
    const expiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Get the user's email address
    const profileRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : {};

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Delete any existing tokens and insert new ones
    await supabaseAdmin.from("gmail_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { error: insertError } = await supabaseAdmin.from("gmail_tokens").insert({
      connected_by: "00000000-0000-0000-0000-000000000001", // service-level connection
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry.toISOString(),
      email_address: profile.emailAddress || null,
    });

    if (insertError) {
      console.error("Failed to store Gmail tokens:", insertError);
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/integrations?gmail_error=storage_failed` },
      });
    }

    // Also upsert company_integrations status
    await supabaseAdmin.from("company_integrations").upsert(
      {
        integration_id: "gmail",
        status: "connected",
        last_sync: new Date().toISOString(),
      },
      { onConflict: "integration_id" }
    );

    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/integrations?gmail_connected=true` },
    });
  } catch (error) {
    console.error("Gmail callback error:", error);
    const appUrl = Deno.env.get("APP_URL") || "https://duncan-help.lovable.app";
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/integrations?gmail_error=unknown` },
    });
  }
});
