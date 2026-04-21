import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CEO_EMAIL = "nimesh@kabuni.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ─── 2026 Non-negotiable priorities (canonical) ────────────────────────────
// Strict, distinctive multi-word aliases ONLY. Generic words removed to prevent
// false-positive coverage matches (e.g. "event", "launch", "app", "duncan").
const PRIORITY_DEFINITIONS = [
  {
    id: "lightning_strike",
    title: "Lightning Strike India — 7 June 2026",
    aliases: ["lightning strike", "india launch", "7 june 2026", "june 7 2026"],
    why_it_matters: "The single hard deadline anchoring every other 2026 priority. Slip = cascade.",
    expected_owner: "Nimesh (CEO) + Simon (Ops Director)",
  },
  {
    id: "kpl_registrations",
    title: "1M Kabuni Premier League registrations",
    aliases: ["kpl registration", "premier league registration", "1m registration", "1 million registration"],
    why_it_matters: "Top of funnel for trials, selection and pre-orders. Without it, nothing downstream works.",
    expected_owner: "Alex (CMO)",
  },
  {
    id: "trials",
    title: "Trials October & November 2026",
    aliases: ["selection trials", "trials 2026", "october trials", "november trials"],
    why_it_matters: "Conversion event from 1M registrations to the 10-team selection.",
    expected_owner: "Simon (Ops Director)",
  },
  {
    id: "team_selection",
    title: "Final 10-team selection — December 2026 (10 Super Coaches)",
    aliases: ["10 team selection", "10-team selection", "super coaches", "december selection"],
    why_it_matters: "The product output of the entire trials funnel. Defines the league.",
    expected_owner: "Simon (Ops Director) + Matt (CPO)",
  },
  {
    id: "preorders",
    title: "100,000 pre-orders",
    aliases: ["pre-order", "preorder", "100k pre", "100,000 pre"],
    why_it_matters: "Primary commercial proof point for investors and supply chain commitments.",
    expected_owner: "Alex (CMO) + Patrick (CFO)",
  },
  {
    id: "duncan_automation",
    title: "Duncan automates 25% of the company",
    aliases: ["duncan automation", "automate company", "25% automation", "operating leverage"],
    why_it_matters: "Operating-leverage thesis. Without this, the company can't scale into 2027.",
    expected_owner: "Palash (Head of Duncan)",
  },
];

const MORNING_SCHEMA_HINT = `Return STRICT JSON with this exact shape:
{
  "trajectory": "On Track" | "Slight Drift" | "At Risk" | "Off Track",
  "outcome_probability": number (0-100),
  "execution_score": number (0-100),
  "workstream_scores": [{
    "name": string,                  // MUST be drawn verbatim from available_workstreams. NEVER invented.
    "progress": number,
    "confidence": number,
    "risk": number,
    "progress_vs_goal": string,
    "execution_quality": string,
    "commercial_impact": string,
    "dependency_strength": string,
    "evidence": string               // MUST cite a real card title, Azure work item, or release. No generic prose.
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
    "coverage_gaps": [{
      "priority": string,                       // priority title from priority_definitions
      "why_it_matters": string,
      "consequence_if_unowned": string,
      "recommended_owner": string,
      "recommended_workstream_name": string     // suggested project_tag for the new workstream
    }],
    "what_changed": [{"function_area": "Launch & India" | "Product & Technology" | "Growth & Marketing" | "Operations & Delivery" | "Finance & Legal" | "Duncan Automation", "moved": string, "did_not_move": string, "needs_attention": string}],
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

CRITICAL RULES:
- "workstream_scores[].name" MUST come verbatim from "available_workstreams" in the source data. Do NOT invent workstreams. Do NOT use the function-bucket names in "what_changed" (Launch & India, Product & Technology, etc.) as workstream names — those are reporting lenses, not workstreams. If "available_workstreams" is empty, return "workstream_scores": [] and say so in payload.company_pulse.
- "function_area" in "what_changed" is a REPORTING LENS, not a workstream identifier.
- For every entry in "coverage_report" where status = "missing", you MUST add an entry to payload.coverage_gaps. Do NOT fabricate scores for missing priorities — flag them as gaps instead.
- payload.brutal_truth MUST mention any uncovered 2026 priority by name when coverage_gaps is non-empty.
- HONEST SCORING: If fewer than half of the 6 priorities have a workstream (coverage_ratio < 0.5), outcome_probability MUST be ≤ 35, execution_score MUST be ≤ 40, and trajectory MUST be "At Risk" or "Off Track". State the reason in payload.execution_explanation: "Low-evidence briefing — N of 6 priorities have no owned workstream." You cannot honestly project >35% probability against a plan you cannot see.
- "tldr" must directly answer the three Final Instruction questions in 1-2 sentences each.
- For each workstream score, all six analytical-framework axes are MANDATORY (progress_vs_goal, execution_quality, commercial_impact, dependency_strength + scores).
- Risk windows (7d/30d/90d) must be structured objects, never loose strings.
- Every workstream "evidence" string MUST quote a real card title, Azure work item, or release from the source data.`;

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
- WORKSTREAM INTEGRITY: only score workstreams that exist in available_workstreams. Never fabricate. If a 2026 priority has no workstream, surface it as a coverage_gap — that gap is itself the most important signal.

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
- Justify every score with evidence from the source data (cite real card titles / work items / releases).
- Do not change a score without reason vs the previous briefing.

FINAL INSTRUCTION (the briefing must answer these three):
1. Are we on track?
2. What will break?
3. Where must I act?

Surface these answers in the "tldr" field at the top. If you cannot answer them clearly from the data provided, the briefing has failed.`;

// Strict 1:1 coverage detection.
// - Match ONLY against workstream names (project_tag + azure project_name), NOT card titles.
// - First-match-wins: a workstream can satisfy only ONE priority, then it's consumed.
// - Aliases are multi-word distinctive phrases (see PRIORITY_DEFINITIONS).
function detectCoverage(
  priorities: typeof PRIORITY_DEFINITIONS,
  workstreams: string[],
  _cardTitles: string[], // intentionally ignored — too noisy
) {
  const claimed = new Set<string>();
  const wsLower = workstreams.map((w) => ({ orig: w, low: (w || "").toLowerCase() }));
  return priorities.map((p) => {
    let matched: string | null = null;
    for (const alias of p.aliases) {
      const a = alias.toLowerCase();
      const found = wsLower.find((w) => !claimed.has(w.orig) && w.low.includes(a));
      if (found) {
        matched = found.orig;
        claimed.add(found.orig);
        break;
      }
    }
    return {
      priority_id: p.id,
      priority: p.title,
      status: matched ? ("covered" as const) : ("missing" as const),
      matched_workstream: matched,
      why_it_matters: p.why_it_matters,
      expected_owner: p.expected_owner,
    };
  });
}

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
      slackLogs, tokenUsage, xeroInvoices, xeroContacts, auditLogs,
      // Canonical workstream sources (full sets, not just 24h)
      allCards, allWorkItems,
      // Recent transcripts for implicit-coverage scanning (last 10, any date)
      recentTranscripts,
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
      safe(admin.from("slack_notification_logs").select("event_key,status,sent_at,payload").gte("created_at", since).limit(40)),
      safe(admin.from("token_usage").select("user_id,total_tokens,request_count,usage_date").gte("usage_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).limit(100)),
      safe(admin.from("xero_invoices").select("invoice_number,contact_name,total,amount_due,amount_paid,status,type,due_date,date").gte("synced_at", since).order("date", { ascending: false }).limit(40)),
      safe(admin.from("xero_contacts").select("name,outstanding_balance,overdue_balance").gt("overdue_balance", 0).order("overdue_balance", { ascending: false }).limit(15)),
      safe(admin.from("integration_audit_logs").select("integration,action,details,created_at").gte("created_at", since).limit(40)),
      safe(admin.from("workstream_cards").select("title,project_tag").is("archived_at", null).limit(500)),
      safe(admin.from("azure_work_items").select("title,project_name").limit(500)),
      safe(admin.from("meetings").select("title,meeting_date,transcript").not("transcript", "is", null).order("meeting_date", { ascending: false }).limit(10)),
    ]);

    // ─── Scan recent meeting transcripts for priority signals ─────
    // Detects implicit coverage — work happening on a 2026 priority WITHOUT a workstream.
    function scanTranscriptsForPriorities(
      transcripts: Array<{ title: string; meeting_date: string | null; transcript: string | null }>,
    ) {
      const PER_TRANSCRIPT_CAP = 6000;
      const SNIPPET_RADIUS = 200;
      return PRIORITY_DEFINITIONS.map((p) => {
        const mentions: Array<{ meeting_title: string; meeting_date: string | null; snippet: string; alias_matched: string }> = [];
        for (const m of transcripts) {
          if (!m.transcript) continue;
          const text = m.transcript.slice(0, PER_TRANSCRIPT_CAP);
          const lower = text.toLowerCase();
          for (const alias of p.aliases) {
            const idx = lower.indexOf(alias.toLowerCase());
            if (idx >= 0) {
              const start = Math.max(0, idx - SNIPPET_RADIUS);
              const end = Math.min(text.length, idx + alias.length + SNIPPET_RADIUS);
              mentions.push({
                meeting_title: m.title,
                meeting_date: m.meeting_date,
                snippet: text.slice(start, end).replace(/\s+/g, " ").trim(),
                alias_matched: alias,
              });
              break; // one snippet per priority per meeting
            }
          }
          if (mentions.length >= 5) break; // cap mentions per priority
        }
        return { priority_id: p.id, priority_title: p.title, mentions };
      }).filter((s) => s.mentions.length > 0);
    }

    const meeting_priority_signals = scanTranscriptsForPriorities(recentTranscripts as any[]);

    // ─── Canonical workstream list ────────────────────────────────
    const projectTags = Array.from(
      new Set((allCards as any[]).map((c) => c.project_tag).filter((t): t is string => !!t && t.trim().length > 0))
    );
    const azureProjects = Array.from(
      new Set((allWorkItems as any[]).map((w) => w.project_name).filter((p): p is string => !!p && p.trim().length > 0))
    );
    const available_workstreams = Array.from(new Set([...projectTags, ...azureProjects])).sort();

    const allCardTitles = (allCards as any[]).map((c) => c.title).filter(Boolean) as string[];
    const allAzureTitles = (allWorkItems as any[]).map((w) => w.title).filter(Boolean) as string[];

    const coverage_report = detectCoverage(
      PRIORITY_DEFINITIONS,
      available_workstreams,
      [...allCardTitles, ...allAzureTitles],
    );

    const context = {
      now_utc: new Date().toISOString(),
      window: "last 24h",
      available_workstreams,
      priority_definitions: PRIORITY_DEFINITIONS.map((p) => ({
        id: p.id,
        title: p.title,
        why_it_matters: p.why_it_matters,
        expected_owner: p.expected_owner,
      })),
      coverage_report,
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

Source data (24h activity window; available_workstreams + coverage_report are full-set):
${JSON.stringify(context).slice(0, 120000)}

If previous_briefing is non-null, explain probability/score deltas vs it. Keep prose tight, executive, no fluff. If a data source is empty, say so — do not invent activity. Remember: workstream_scores ⊆ available_workstreams; missing priorities → coverage_gaps, NOT fabricated scores.`;

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

    // ─── Server-side guardrails ─────────────────────────────────
    // 1. Strip any fabricated workstream scores (must be in available_workstreams)
    if (Array.isArray(parsed.workstream_scores) && available_workstreams.length > 0) {
      const allowed = new Set(available_workstreams.map((s) => s.toLowerCase()));
      parsed.workstream_scores = parsed.workstream_scores.filter(
        (w: any) => w?.name && allowed.has(String(w.name).toLowerCase())
      );
    }
    // 2. Ensure coverage_gaps reflects actual missing priorities (server-authoritative)
    parsed.payload = parsed.payload || {};
    const missing = coverage_report.filter((c) => c.status === "missing");
    const covered = coverage_report.filter((c) => c.status === "covered");
    const modelGaps = Array.isArray(parsed.payload.coverage_gaps) ? parsed.payload.coverage_gaps : [];
    parsed.payload.coverage_gaps = missing.map((m) => {
      const fromModel = modelGaps.find((g: any) =>
        (g?.priority || "").toLowerCase().includes(m.priority.toLowerCase().split("—")[0].trim().slice(0, 12))
      );
      return {
        priority_id: m.priority_id,
        priority: m.priority,
        why_it_matters: fromModel?.why_it_matters || m.why_it_matters,
        consequence_if_unowned: fromModel?.consequence_if_unowned || "No accountable owner means no progress and no escalation path — this priority will silently slip.",
        recommended_owner: fromModel?.recommended_owner || m.expected_owner,
        recommended_workstream_name: fromModel?.recommended_workstream_name || m.priority.split("—")[0].trim(),
      };
    });

    // 3. Coverage summary (server-authoritative)
    const totalPriorities = PRIORITY_DEFINITIONS.length;
    const coverageRatio = covered.length / totalPriorities;
    parsed.payload.coverage_summary = {
      covered: covered.length,
      total: totalPriorities,
      ratio: Number(coverageRatio.toFixed(2)),
      covered_priorities: covered.map((c) => ({ priority: c.priority, matched_workstream: c.matched_workstream })),
      missing_priorities: missing.map((m) => m.priority),
    };
    parsed.payload.available_workstreams = available_workstreams;

    // 4. Honest scoring clamp — cannot project high probability against a plan you cannot see.
    if (briefing_type === "morning" && coverageRatio < 0.5) {
      const probCap = 35;
      const execCap = 40;
      const origProb = typeof parsed.outcome_probability === "number" ? parsed.outcome_probability : null;
      const origExec = typeof parsed.execution_score === "number" ? parsed.execution_score : null;
      if (origProb === null || origProb > probCap) parsed.outcome_probability = probCap;
      if (origExec === null || origExec > execCap) parsed.execution_score = execCap;
      // Force trajectory honest
      const traj = (parsed.trajectory || "").toLowerCase();
      if (traj === "on track" || traj === "slight drift" || !traj) {
        parsed.trajectory = coverageRatio < 0.34 ? "Off Track" : "At Risk";
      }
      parsed.payload.confidence_warning = {
        reason: `Low-evidence briefing — Duncan can only see ${covered.length} of ${totalPriorities} 2026 priorities. Probability capped at ${probCap}% and execution at ${execCap}/100 until missing workstreams are created.`,
        original_probability: origProb,
        original_execution: origExec,
        applied_probability_cap: probCap,
        applied_execution_cap: execCap,
      };
    }

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
