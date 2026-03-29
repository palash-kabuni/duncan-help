import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const HIREFLIX_API_KEY = Deno.env.get("HIREFLIX_API_KEY");
  if (!HIREFLIX_API_KEY) {
    return new Response(JSON.stringify({ error: "No API key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Introspect QuestionInputType and PositionInputType
  const introspectionQuery = `{
    questionInput: __type(name: "QuestionInputType") {
      name
      inputFields { name type { name kind ofType { name kind } } }
    }
    positionInput: __type(name: "PositionInputType") {
      name
      inputFields { name type { name kind ofType { name kind } } }
    }
    positionSaveInput: __type(name: "PositionSaveInputType") {
      name
      inputFields { name type { name kind ofType { name kind } } }
    }
    mutation: __type(name: "Mutation") {
      name
      fields { name args { name type { name kind ofType { name kind } } } }
    }
    interviewType: __type(name: "InterviewType") {
      name
      fields { name type { name kind ofType { name kind } } }
    }
    urlType: __type(name: "UrlType") {
      name
      fields { name type { name kind ofType { name kind } } }
    }
    interviewUrlType: __type(name: "InterviewUrlType") {
      name
      fields { name type { name kind ofType { name kind } } }
    }
  }`;

  const res = await fetch("https://api.hireflix.com/me", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": HIREFLIX_API_KEY },
    body: JSON.stringify({ query: introspectionQuery }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
