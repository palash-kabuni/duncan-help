import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CEO_EMAIL = "nimesh@kabuni.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MORNING_SCHEMA_HINT = `Return STRICT JSON with this exact shape:
{
  "trajectory": "On Track" | "Slight Drift" | "At Risk" | "Off Track",
  "outcome_probability": number (0-100),
  "execution_score": number (0-100),
  "workstream_scores": [{"name": string, "progress": number, "confidence": number, "risk": number, "evidence": string}],
  "payload": {
    "company_pulse": string,
    "probability_movement": string,
    "execution_explanation": string,
    "what_changed": [{"function": "Launch & India" | "Product & Technology" | "Growth & Marketing" | "Operations & Delivery" | "Finance & Legal" | "Duncan Automation", "moved": string, "did_not_move": string, "needs_attention": string}],
    "risks": [{"risk": string, "why_it_matters": string, "impact_7d": string, "impact_30d": string, "impact_90d": string, "owner": string, "severity": "low"|"medium"|"high"|"critical", "confidence": number}],
    "friction": [{"issue": string, "teams": string[], "consequence": string}],
    "leadership": [{"name": string, "role": string, "output_vs_expectation": string, "risk_level": "low"|"medium"|"high", "blocking": string, "needs_support": string, "ceo_intervention_required": boolean}],
    "watchlist": [{"workstream": string, "owner": string, "status": string, "missing": string}],
    "decisions": [{"decision": string, "why_it_matters": string, "consequence": string, "who_to_involve": string}],
    "automation": {"percent": number, "working": string, "manual": string, "next": string, "blockers": string},
    "brutal_truth": string
  }
}`;

const EVENING_SCHEMA_HINT = `Return STRICT JSON:
{
  "trajectory": "On Track"|"Slight Drift"|"At Risk"|"Off Track",
  "outcome_probability": number,
  "execution_score": number,
  "workstream_scores": [],
  "payload": {
    "got_done": string,
    "slipped": string,
    "new_risks": string,
    "ownership_gaps": string,
    "execution_rating": "Strong"|"Mixed"|"Weak",
    "execution_explanation": string,
    "tomorrow_priorities": [string, string, string]
  }
}`;

const SYSTEM_PROMPT = `You are Duncan, CEO operating intelligence for Kabuni.

NON-NEGOTIABLE 2026 PRIORITIES:
1. Lightning Strike India — 7 June 2026
2. 1M Kabuni Premier League registrations
3. Trials October & November 2026
4. Final 10-team selection December (10 Super Coaches)
5. 100,000 pre-orders
6. Duncan automates 25% of the company

ORG MAP:
- Nimesh Patel = CEO
- Patrick = CFO
- Ellaine = COO/CLO
- Matt = CPO
- Alex = CMO
- Simon = Operations Director
- Palash = Head of Duncan
- Parmy = CTO

Rules:
- Truth Over Narrative: prioritise data reality over what people claim.
- Illusion Detection: call out activity that masquerades as progress.
- Pattern Recognition: compare today vs yesterday.
- Pressure Rule: if drifting, increase urgency, do not normalise underperformance.
- Justify every score with evidence. If data is weak, lower confidence.
- Be brutally direct. The CEO needs truth, not comfort.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const email = (claimsData.claims.email as string | undefined)?.toLowerCase() ?? "";
    if (email !== CEO_EMAIL) return json({ error: "Forbidden — CEO only" }, 403);

    const userId = claimsData.claims.sub as string;
    const body = await req.json().catch(() => ({}));
    const briefing_type: "morning" | "evening" = body?.briefing_type === "evening" ? "evening" : "morning";

    // Service-role client for cross-table reads
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      meetingsRes, cardsRes, activityRes, workItemsRes, releasesRes,
      candidatesRes, posRes, issuesRes, syncRes, profilesRes, prevRes
    ] = await Promise.all([
      admin.from("meetings").select("title,meeting_date,summary,action_items,participants").gte("meeting_date", since).limit(20),
      admin.from("workstream_cards").select("title,status,priority,project_tag,owner_id,due_date,updated_at").gte("updated_at", since).limit(50),
      admin.from("workstream_activity").select("action,details,created_at,card_id").gte("created_at", since).limit(100),
      admin.from("azure_work_items").select("title,state,assigned_to,project_name,changed_date,priority").gte("changed_date", since).limit(50),
      admin.from("releases").select("version,title,summary,status,created_at,published_at").order("created_at", { ascending: false }).limit(5),
      admin.from("candidates").select("name,status,total_score,job_role_id,updated_at").gte("updated_at", since).limit(30),
      admin.from("purchase_orders").select("po_number,vendor_name,total_amount,status,category,created_at").gte("created_at", since).limit(20),
      admin.from("issues").select("title,severity,issue_type,created_at").gte("created_at", since).limit(20),
      admin.from("sync_logs").select("integration,status,sync_type,started_at,error_message").gte("started_at", since).limit(30),
      admin.from("profiles").select("display_name,role_title,department"),
      admin.from("ceo_briefings").select("briefing_date,outcome_probability,execution_score,trajectory")
        .eq("briefing_type", briefing_type).order("briefing_date", { ascending: false }).limit(1),
    ]);

    const context = {
      now_utc: new Date().toISOString(),
      window: "last 24h",
      meetings: meetingsRes.data ?? [],
      workstream_cards: cardsRes.data ?? [],
      workstream_activity: activityRes.data ?? [],
      azure_work_items: workItemsRes.data ?? [],
      recent_releases: releasesRes.data ?? [],
      candidates: candidatesRes.data ?? [],
      purchase_orders: posRes.data ?? [],
      issues: issuesRes.data ?? [],
      sync_logs: syncRes.data ?? [],
      team_directory: profilesRes.data ?? [],
      previous_briefing: prevRes.data?.[0] ?? null,
    };

    const userPrompt = `Generate the ${briefing_type === "evening" ? "EVENING ACCOUNTABILITY" : "MORNING CEO"} BRIEFING.

${briefing_type === "evening" ? EVENING_SCHEMA_HINT : MORNING_SCHEMA_HINT}

Source data (24h window):
${JSON.stringify(context).slice(0, 60000)}

If previous_briefing is non-null, explain probability/score deltas vs it. Keep prose tight, executive, no fluff.`;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not configured" }, 500);

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI error:", errText);
      return json({ error: "AI generation failed", details: errText.slice(0, 500) }, 502);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch (e) { return json({ error: "Invalid JSON from model", raw: raw.slice(0, 500) }, 502); }

    const briefing_date = new Date().toISOString().slice(0, 10);

    const { data: saved, error: saveErr } = await admin
      .from("ceo_briefings")
      .upsert({
        briefing_date,
        briefing_type,
        trajectory: parsed.trajectory ?? null,
        outcome_probability: parsed.outcome_probability ?? null,
        execution_score: parsed.execution_score ?? null,
        workstream_scores: parsed.workstream_scores ?? [],
        payload: parsed.payload ?? {},
        generated_by: userId,
      }, { onConflict: "briefing_date,briefing_type" })
      .select()
      .single();

    if (saveErr) {
      console.error("Save error:", saveErr);
      return json({ error: "Failed to persist briefing", details: saveErr.message }, 500);
    }

    return json({ briefing: saved });
  } catch (e: any) {
    console.error("ceo-briefing fatal:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
