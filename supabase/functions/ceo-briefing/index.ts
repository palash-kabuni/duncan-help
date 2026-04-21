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
  "workstream_scores": [{
    "name": string,
    "progress": number,
    "confidence": number,
    "risk": number,
    "progress_vs_goal": string,
    "execution_quality": string,
    "commercial_impact": string,
    "dependency_strength": string,
    "evidence": string
  }],
  "payload": {
    "tldr": {
      "on_track": string,
      "what_will_break": string,
      "where_to_act": string
    },
    "company_pulse": string,
    "probability_movement": string,
    "execution_explanation": string,
    "what_changed": [{"function": "Launch & India" | "Product & Technology" | "Growth & Marketing" | "Operations & Delivery" | "Finance & Legal" | "Duncan Automation", "moved": string, "did_not_move": string, "needs_attention": string}],
    "risks": [{
      "risk": string,
      "why_it_matters": string,
      "impact_7d": { "window": "7d", "impact": string, "mitigation": string },
      "impact_30d": { "window": "30d", "impact": string, "mitigation": string },
      "impact_90d": { "window": "90d", "impact": string, "mitigation": string },
      "owner": string,
      "severity": "low"|"medium"|"high"|"critical",
      "confidence": number
    }],
    "friction": [{"issue": string, "teams": string[], "consequence": string}],
    "leadership": [{"name": string, "role": string, "output_vs_expectation": string, "risk_level": "low"|"medium"|"high", "blocking": string, "needs_support": string, "ceo_intervention_required": boolean}],
    "watchlist": [{"workstream": string, "owner": string, "status": string, "missing": string}],
    "decisions": [{"decision": string, "why_it_matters": string, "consequence": string, "who_to_involve": string}],
    "automation": {"percent": number, "working": string, "manual": string, "next": string, "blockers": string},
    "brutal_truth": string
  }
}

CRITICAL:
- "tldr" must directly answer the three Final Instruction questions in 1-2 sentences each.
- For each workstream score, all six analytical-framework axes are MANDATORY (progress_vs_goal, execution_quality, commercial_impact, dependency_strength + scores).
- Risk windows (7d/30d/90d) must be structured objects, never loose strings.`;

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

const SYSTEM_PROMPT = `You are Duncan, the internal operating system for Kabuni and the CEO's real-time executive intelligence layer.

You are NOT a summariser. You are NOT a passive assistant. You ARE a decision engine.

NON-NEGOTIABLE 2026 PRIORITIES (ground every analysis here):
1. Lightning Strike India — 7 June 2026
2. 1M Kabuni Premier League registrations
3. Trials October & November 2026
4. Final 10-team selection December (10 Super Coaches)
5. 100,000 pre-orders
6. Duncan automates 25% of the company

If activity does not move one of these, it is secondary unless it removes a major risk.

ORG MAP (enforce ownership):
Nimesh = CEO · Patrick = CFO · Ellaine = COO/CLO · Matt = CPO · Alex = CMO · Simon = Operations Director · Palash = Head of Duncan · Parmy = CTO

DECISION & ESCALATION LOGIC:
Strategic→CEO · Financial→CFO · Execution→COO · Product→CPO · Growth→CMO · Tech→CTO · Automation→Head of Duncan. Cross-functional issues → flag and escalate to CEO.

DATA RULES:
- Truth Over Narrative: data reality wins. Call out conflicts between team narrative and source data.
- Illusion Detection: name activity that masquerades as progress (meetings replacing decisions, momentum without conversion, output not moving the 6 priorities).
- Pattern Recognition: compare today vs prior briefing. Flag worsening or improving trends. Never treat each day in isolation.
- Pressure Rule: if drifting or at risk → increase urgency, make consequences explicit, never normalise underperformance.
- If data is weak → LOWER confidence and say so explicitly.

ANALYTICAL FRAMEWORK (apply to every workstream):
1. Progress vs company goals
2. Execution quality
3. Risk exposure
4. Commercial impact
5. Dependency strength
6. Cross-functional alignment

SCORING CONTRACT:
- Every workstream gets Progress (0-100), Confidence (0-100), Risk (0-100) + the 4 framework axes.
- Overall Company Execution Score (0-100).
- Justify every score with evidence from the source data.
- Do not change a score without reason vs the previous briefing.

FINAL INSTRUCTION (the briefing must answer these three):
1. Are we on track?
2. What will break?
3. Where must I act?

Surface these answers in the "tldr" field at the top. If you cannot answer them clearly from the data provided, the briefing has failed.`;

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const safe = async <T>(p: Promise<{ data: T | null; error: any }>): Promise<T[]> => {
      try { const r = await p; return (r?.data as any) ?? []; } catch { return []; }
    };

    const [
      meetings, cards, activity, workItems, releases,
      candidates, pos, issues, syncLogs, profiles, prev,
      // NEW sources
      slackLogs, tokenUsage, xeroInvoices, xeroContacts, auditLogs,
    ] = await Promise.all([
      safe(admin.from("meetings").select("title,meeting_date,summary,action_items,participants").gte("meeting_date", since).limit(20)),
      safe(admin.from("workstream_cards").select("title,status,priority,project_tag,owner_id,due_date,updated_at").gte("updated_at", since).limit(50)),
      safe(admin.from("workstream_activity").select("action,details,created_at,card_id").gte("created_at", since).limit(100)),
      safe(admin.from("azure_work_items").select("title,state,assigned_to,project_name,changed_date,priority").gte("changed_date", since).limit(50)),
      safe(admin.from("releases").select("version,title,summary,status,created_at,published_at").order("created_at", { ascending: false }).limit(5)),
      safe(admin.from("candidates").select("name,status,total_score,job_role_id,updated_at").gte("updated_at", since).limit(30)),
      safe(admin.from("purchase_orders").select("po_number,vendor_name,total_amount,status,category,created_at").gte("created_at", since).limit(20)),
      safe(admin.from("issues").select("title,severity,issue_type,created_at").gte("created_at", since).limit(20)),
      safe(admin.from("sync_logs").select("integration,status,sync_type,started_at,error_message").gte("started_at", since).limit(30)),
      safe(admin.from("profiles").select("display_name,role_title,department")),
      safe(admin.from("ceo_briefings").select("briefing_date,outcome_probability,execution_score,trajectory")
        .eq("briefing_type", briefing_type).order("briefing_date", { ascending: false }).limit(1)),
      // NEW
      safe(admin.from("slack_notification_logs").select("event_key,status,sent_at,payload").gte("created_at", since).limit(40)),
      safe(admin.from("token_usage").select("user_id,total_tokens,request_count,usage_date").gte("usage_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).limit(100)),
      safe(admin.from("xero_invoices").select("invoice_number,contact_name,total,amount_due,amount_paid,status,type,due_date,date").gte("synced_at", since).order("date", { ascending: false }).limit(40)),
      safe(admin.from("xero_contacts").select("name,outstanding_balance,overdue_balance").gt("overdue_balance", 0).order("overdue_balance", { ascending: false }).limit(15)),
      safe(admin.from("integration_audit_logs").select("integration,action,details,created_at").gte("created_at", since).limit(40)),
    ]);

    const context = {
      now_utc: new Date().toISOString(),
      window: "last 24h",
      meetings,
      workstream_cards: cards,
      workstream_activity: activity,
      azure_work_items: workItems,
      recent_releases: releases,
      candidates,
      purchase_orders: pos,
      issues,
      sync_logs: syncLogs,
      slack_notifications_24h: slackLogs,
      token_usage_7d: tokenUsage,
      xero_invoices_24h: xeroInvoices,
      xero_overdue_contacts: xeroContacts,
      integration_audit_24h: auditLogs,
      team_directory: profiles,
      previous_briefing: (prev as any)?.[0] ?? null,
    };

    const userPrompt = `Generate the ${briefing_type === "evening" ? "EVENING ACCOUNTABILITY" : "MORNING CEO"} BRIEFING.

${briefing_type === "evening" ? EVENING_SCHEMA_HINT : MORNING_SCHEMA_HINT}

Source data (24h window unless noted):
${JSON.stringify(context).slice(0, 120000)}

If previous_briefing is non-null, explain probability/score deltas vs it. Keep prose tight, executive, no fluff. If a data source is empty, say so — do not invent activity.`;

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
