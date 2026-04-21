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
    expected_owner: "Simon (Ops Director) + Alex (CMO)",
  },
  {
    id: "team_selection",
    title: "Final 10-team selection — December 2026 (10 Super Coaches)",
    aliases: ["10 team selection", "10-team selection", "super coaches", "december selection"],
    why_it_matters: "The product output of the entire trials funnel. Defines the league.",
    expected_owner: "Matt (CPO) + Simon (Ops Director)",
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
      "confidence": number,
      "probability_impact_pts": number
    }],
    "friction": [{"issue": string, "teams": string[], "consequence": string, "evidence_source": "workstream_card"|"meeting"|"email"|"coverage_gap"|"silent_leader"|"doc_conflict", "recommended_resolver": string, "auto_injected": boolean}],
    "leadership": [{"name": string, "role": string, "output_vs_expectation": string, "risk_level": "low"|"medium"|"high", "blocking": string, "needs_support": string, "ceo_intervention_required": boolean, "signal_status": "active"|"low_signal"|"silent", "evidence_sources": [string]}],
    "watchlist": [{"workstream": string, "owner": string, "status": string, "good_looks_like": string, "missing": string, "data_blind_spot": string|null, "auto_injected": boolean}],
    "decisions": [{"decision": string, "why_it_matters": string, "consequence": string, "who_to_involve": string, "confidence": "high"|"medium"|"low", "blocked_by_missing_data": string|null, "evidence_source": "coverage_gap"|"silent_priority"|"risk"|"friction"|"email"|"silent_leader"|"data_blind_spot"|"workstream"|null, "auto_injected": boolean}],
    "automation": {"percent": number, "working": string, "manual": string, "next": string, "blockers": string},
    "automation_progress": {
      "company_usage": {
        "total_tokens": number,
        "request_count": number,
        "active_users": number,
        "dow_change_pct": number,
        "wow_change_pct": number,
        "trend_label": "Adoption accelerating" | "Adoption steady" | "Flat" | "Declining" | "Insufficient data"
      },
      "top_users": [{
        "rank": number,
        "name": string,
        "role": string,
        "department": string,
        "total_tokens": number,
        "request_count": number,
        "primary_use": string,
        "est_hours_saved": number
      }],
      "recommendations": [{
        "title": string,
        "why_now": string,
        "expected_leverage": "Low" | "Medium" | "High",
        "effort": "S" | "M" | "L",
        "auto_injected": boolean,
        "evidence_source": "coverage_gap" | "silent_priority" | "friction" | "stuck_workstream" | "heavy_manual_surface" | "failed_tool_call" | "model"
      }]
    },
    "brutal_truth": string,
    "document_intelligence": [{
      "domain": string,
      "file_name": string,
      "verdict": "weak"|"adequate"|"strong",
      "what_it_covers": string,
      "what_is_missing_in_doc": string,
      "contradicted_by": [string],
      "reinforced_by": [string],
      "critical_gaps_to_fix": [string]
    }],
    "missing_artifacts_recommendations": [{
      "domain": string,
      "priority": "critical"|"high"|"medium"|"low",
      "artifacts": [{
        "name": string,
        "why_duncan_needs_it": string,
        "what_it_unlocks": string,
        "where_to_find_it": string,
        "suggested_filename_pattern": string,
        "blast_radius": [string]
      }]
    }]
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
- Every workstream "evidence" string MUST quote a real card title, Azure work item, or release from the source data.
- watchlist[].good_looks_like MUST be a concrete, observable definition of done for that workstream. Never vague.
- watchlist[].data_blind_spot MUST be set (non-null) whenever the workstream's function area maps to a Red or Yellow domain in payload.data_coverage_audit. Name the missing document/signal explicitly. Set null ONLY when fully evidenced.
- watchlist[].owner MUST be the person actually accountable for the SPECIFIC blocker — derived from workstream_cards.owner_id (resolved via team_directory display_name), azure_work_items.assigned_to, or the function area. Use PRIORITY_DEFINITIONS.expected_owner ONLY as a tie-breaker, NEVER as the default. NO single owner may appear on more than 40% of watchlist rows. Split concentrated rows into sub-issues attributed to the actual contributors (CMO for marketing blockers, CFO for funding gates, CTO for tech readiness, COO for execution gaps), or escalate to "Cross-functional — escalate to CEO".
- payload.watchlist POPULATION RULES: watchlist[] is the operational accountability ledger. It MUST contain one row for EACH of the following, with NO duplicates (matched case-insensitively by workstream name):
    a. Every workstream_score where rag != "green" (Red, Yellow, At Risk).
    b. Every entry in headline_context.silent_priorities (owner = PRIORITY_DEFINITIONS.expected_owner, status = "Silent", missing = "No cards, no Azure items, no releases attributed in the last 7 days").
    c. Every 2026 priority where data_coverage_audit.strategic_coverage coverage_pct < 50 that is not already covered by (a) or (b) — status = "Uncovered".
    d. Every leader_signal_map entry with signal_status="silent" AND owns_priorities.length > 0 — one row per priority they own (status = "Silent", owner = leader name, missing = "Owner silent 7d — no operational signal").
  MINIMUM count = max(3, count of non-green workstreams + silent_priorities). An empty watchlist[] when outcome_probability < 70 OR coverage_gaps is non-empty is a reporting failure.
  For each row: "workstream" = exact name from workstream_scores OR the 2026 priority name; "status" = one of "Red"|"Yellow"|"At Risk"|"Silent"|"Uncovered"; "good_looks_like" = observable definition of done (rule above); "missing" = the SPECIFIC artifact, decision, or signal that's absent; "data_blind_spot" = Red/Yellow domain name if applicable, else null; "auto_injected" = false (only the post-processor sets true).
- decisions[].confidence MUST NEVER exceed payload.data_coverage_audit.confidence_cap.
- payload.data_coverage_audit.strategic_coverage is the SERVER-AUTHORITATIVE per-priority artifact gap list (required vs supplied per knowledge domain). When citing coverage, ground numbers in this structure — never invent a "% covered". When a 2026 priority has coverage_pct < 40 in payload.data_coverage_audit.strategic_coverage, payload.brutal_truth MUST name it explicitly with its % and the top 2 missing artifact names. decisions[].blocked_by_missing_data MUST cite specific missing artifact names from strategic_coverage when applicable, e.g. "Lightning Strike: missing India launch runbook + vendor MoU — operations blind spot".
- decisions[].blocked_by_missing_data MUST name the Red domain whenever the decision cannot be honestly judged without that evidence. Format: "{domain_label}: {what specifically is missing}". Set null ONLY when fully grounded. When missing_artifacts_recommendations contains specific artifact names that would unblock this decision, prepend: "Needs: {artifact_name_1}, {artifact_name_2} — {domain_label} blind spot."
- payload.decisions POPULATION RULES: decisions[] is the CEO-grade call list — only items that ONLY Nimesh can make or unblock. NOT operational tasks. It MUST draw from, with NO duplicates:
    a. Every entry in payload.coverage_gaps (decision = "Assign accountable owner and stand up workstream for {priority}").
    b. Every entry in headline_context.silent_priorities (same shape as a).
    c. Every payload.risks entry where severity ∈ {"high","critical"} (decision = "Decide mitigation path for {risk_title} or accept the {probability_impact_pts}-pt probability hit").
    d. Every payload.friction entry where recommended_resolver = "CEO" (decision = "Break {teams.join('/')} deadlock on {issue}").
    e. Every email_pulse_signals.escalations item with no clear owner, every board_mention, and every unowned commitment (decision = "Decide owner + response for {topic} surfaced in inbox").
    f. Every leader_signal_map entry with signal_status="silent" AND owns_priorities.length > 0 (decision = "Intervene with {leader} — silent owner of {priority}").
    g. When data_coverage_audit.confidence_cap ∈ {"medium","low"}: at least ONE decision of the form "Pause {board/launch/investor} commitment OR proceed despite {worst_red_domain.label} blind spot" with blocked_by_missing_data populated.
  MINIMUM count = 3 whenever trajectory ≠ "On Track" OR outcome_probability < 70 OR coverage_gaps non-empty OR confidence_cap ≠ "high". An empty decisions[] on a non-green briefing is a reporting failure.
  For each row: "decision" = a binary call only the CEO can make (assign / approve / pause / escalate / overrule); "why_it_matters" = the specific 2026 priority or commitment at stake; "consequence" = what slips in 7 days if the decision is not made; "who_to_involve" = real names from team_directory / leader_signal_map; "confidence" ≤ data_coverage_audit.confidence_cap; "blocked_by_missing_data" populated whenever evidence is insufficient; "evidence_source" tagged to the source list above; "auto_injected" = false (only the post-processor sets true).
- payload.document_intelligence: For EVERY domain in domain_file_review with files_inspected.length > 0, produce one entry. Ground "what_it_covers" in the actual content_excerpt (do NOT invent). Cross-reference the excerpt against xero_invoices, workstream_cards, azure_work_items, meetings, recent_releases — if a number, date, owner, or commitment in the doc disagrees with another data source, list it in contradicted_by with a specific quote (e.g. "Plan assumes £180k Q2 burn but Xero shows £241k actual"). Mark verdict="weak" if the doc is thin, generic, or stale; "strong" only when current, specific, and corroborated by ≥1 other system.
- payload.missing_artifacts_recommendations: THINK LIKE A CHIEF OF STAFF, NOT A CEO. Recommend artifacts the CEO would NEVER think to upload, drawn from the operating_system_checklist in context. Cover ALL 7 knowledge domains (not just Red ones — even Green domains have depth gaps). For each artifact: (a) "what_it_unlocks" MUST tie to a specific briefing section (e.g. "Risk Radar accuracy on India launch", "Decisions §9 confidence cap → high", "Investor advisory grounding"); (b) "where_to_find_it" MUST be grounded in inferred_artifact_signals where a hint exists (e.g. "Heard mentioned in Patrick's 14 Apr meeting — likely in his Drive/email"), otherwise plausible owner+location ("DocuSign — Patrick"); (c) cross-reference meetings, xero_invoices, azure_work_items, recent_releases to INFER artifacts that should exist but haven't been uploaded (AWS invoices in Xero → infer infrastructure cost map; "India launch" in meetings → infer signed vendor MoU; security tags on Azure tickets → infer pen-test report). Maximum 15 artifacts TOTAL across all domains, ranked by unlock-value. Priority levels: "critical" = blocks a §9 decision or board commitment; "high" = caps a major section confidence; "medium"/"low" = depth improvements.
- payload.leadership: You MUST return EXACTLY ONE entry per name in leadership_roster (provided in context). Never omit a leader, never invent extras. For each leader, set "signal_status" from leader_signal_map: "active" (≥2 sources), "low_signal" (1 source), "silent" (0 sources). "evidence_sources" MUST be the array from leader_signal_map.sources for that leader. For SILENT leaders: set ceo_intervention_required=true, risk_level="medium" (or "high" if they own a 2026 priority), output_vs_expectation="No operational signal in 7 days — confirm engagement, blocked status, or capacity issue.", blocking="Invisible to Duncan — unknown.", needs_support="CEO check-in to surface what they are actually working on." For LOW_SIGNAL leaders: flag if their single source is non-execution (only meetings, no cards/Azure/releases). For ACTIVE leaders: ground output_vs_expectation in the SPECIFIC source items in leader_signal_map.sources_detail. Silence from a direct report IS a finding, not a gap to hide.
- payload.risks RECONCILIATION: The risks array MUST collectively explain why outcome_probability is what it is. The "probability gap" = 100 − outcome_probability. The SUM of probability_impact_pts across all risks MUST be within ±10 of that gap. Each risk's probability_impact_pts represents how many points of probability that single risk accounts for (must be a positive integer). At least one risk MUST be tagged severity:"critical" or "high" whenever outcome_probability < 50 OR execution_score < 60. Every silent_priority listed in headline_context.silent_priorities MUST appear as its own dedicated risk with severity:"high" minimum and probability_impact_pts ≥ 12. If you cannot honestly justify the gap with the listed risks, ADD MORE RISKS until you do — do not under-report. Sort risks DESC by probability_impact_pts (biggest contributors first).
- payload.friction RULES: Cross-functional friction is a STRUCTURAL BLOCKER between ≥2 functions/teams that NO single owner can unblock alone. You MUST scan for friction in:
    a. workstream_cards where the owner's function ≠ the function of the blocker mentioned in card.title/notes (e.g. CMO-owned card blocked by tech delivery).
    b. meetings_recent where transcript_summary mentions a decision spanning two functions but no single owner is named.
    c. email_pulse_signals.escalations where from.function ≠ to.function (cross-function escalations are friction).
    d. data_coverage_audit.strategic_coverage where a 2026 priority has artifacts in one domain (e.g. Marketing) but is Red in another (e.g. Operations) — that handoff IS friction.
    e. leader_signal_map where a 2026 priority has active cards but the expected_owner is "silent" — friction between active doers and absent owner.
    f. document_intelligence.contradicted_by entries that span functions (e.g. CFO budget contradicts CMO spend plan).
  For EACH friction:
    - "issue": one sentence naming the structural blocker (NOT a task).
    - "teams": EXACTLY the function names involved (≥2), e.g. ["Marketing","Operations"] or ["CFO","CMO"].
    - "consequence": which 2026 priority this puts at risk + by when.
    - "evidence_source": one of "workstream_card"|"meeting"|"email"|"coverage_gap"|"silent_leader"|"doc_conflict".
    - "recommended_resolver": "CEO" if cross-divisional; otherwise the most senior shared manager.
    - "auto_injected": false (only the post-processor sets true).
  MINIMUM: If outcome_probability < 50 OR any 2026 priority has coverage_pct < 40, friction[] MUST contain ≥3 entries. An empty friction[] on a Red briefing is a reporting failure, not an honest signal of harmony.`;

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
// ─── Knowledge Domains — what Duncan needs to give an honest verdict ───────
// Deterministic, server-side. No AI inference — cannot lie.
const KNOWLEDGE_DOMAINS = [
  {
    id: "operations",
    label: "Operations",
    critical: true,
    file_aliases: [],
    needs: "workstream cards, Azure DevOps work items, recent meetings",
    upload_hint: "Already covered by workstreams + Azure + meetings.",
    prefill_tag: "operations",
  },
  {
    id: "recruitment",
    label: "Recruitment",
    critical: false,
    file_aliases: [],
    needs: "Hireflix candidates + scoring",
    upload_hint: "Already covered by candidate pipeline.",
    prefill_tag: "recruitment",
  },
  {
    id: "finance_transactions",
    label: "Finance — Transactions",
    critical: true,
    file_aliases: [],
    needs: "Xero invoices + contacts",
    upload_hint: "Already covered by Xero — only transactional data, no plan.",
    prefill_tag: "finance",
  },
  {
    id: "finance_planning",
    label: "Finance — Planning",
    critical: true,
    file_aliases: ["finance plan", "financial plan", "budget", "forecast", "cash runway", "p&l", "pnl", "p and l"],
    needs: "Budget vs actual, cash runway, financial plan",
    upload_hint: "Upload to /projects: budget vs actual, cash runway model, 2026 financial plan. Without these Duncan cannot judge if June 7 is financially achievable.",
    prefill_tag: "finance-plan",
  },
  {
    id: "legal",
    label: "Legal & Compliance",
    critical: true,
    file_aliases: ["contract", "nda", "ip register", "ip ", "trademark", "compliance", "msa", "vendor agreement"],
    needs: "Contracts, NDAs, IP register",
    upload_hint: "Upload to /projects: signed Lightning Strike vendor contracts, active NDAs, IP register. Without these Duncan cannot warn you about expiring obligations or unsigned commitments.",
    prefill_tag: "legal",
  },
  {
    id: "technology_direction",
    label: "Technology direction",
    critical: true,
    file_aliases: ["architecture", "tech roadmap", "technology roadmap", "tech plan", "release readiness", "system design", "platform plan"],
    needs: "Architecture diagram, tech roadmap, release readiness",
    upload_hint: "Upload to /projects: architecture diagram, 2026 tech roadmap, release-readiness checklist. Without these Duncan can only see ticket motion, not whether the platform is heading the right way.",
    prefill_tag: "tech-direction",
  },
  {
    id: "product_strategy",
    label: "Product strategy",
    critical: false,
    file_aliases: ["prd", "product requirements", "product roadmap", "customer research", "user research", "discovery"],
    needs: "PRDs, product roadmap, customer research",
    upload_hint: "Upload to /projects: current PRDs, product roadmap, latest customer research. Without these Duncan can only judge product motion, not direction.",
    prefill_tag: "product",
  },
  {
    id: "investor_board",
    label: "Investor / Board",
    critical: false,
    file_aliases: ["board pack", "board update", "investor update", "investor deck", "kpi deck", "board minutes"],
    needs: "Board pack, investor updates, KPI deck",
    upload_hint: "Upload to /projects: latest board pack, recent investor update, current KPI deck. Without these Duncan cannot align internal status with the story being told externally.",
    prefill_tag: "board",
  },
] as const;

// ─── Operating-system checklist — what a Chief of Staff would expect to exist ─
// Per-domain baseline of artifacts the CEO would NOT naturally think to upload.
// Used by the AI to prescribe a shopping list, not just grade what's present.
const OPERATING_SYSTEM_CHECKLIST: Record<string, string[]> = {
  finance_planning: [
    "13-week rolling cash forecast", "Runway model (base/bull/bear)",
    "Unit economics by SKU/segment", "CAC / LTV trend report",
    "AR aging schedule", "12-month payroll forecast", "FX exposure snapshot",
  ],
  finance_transactions: [
    "Reconciled monthly P&L", "Bank-to-Xero reconciliation log",
    "Vendor concentration report (top 10 spend)",
  ],
  legal: [
    "Cap table (current)", "Shareholder agreement", "IP assignment register",
    "Employment contracts (signed)", "Supplier MSAs",
    "Active NDAs (signed register)", "Data Processing Agreements (DPAs)",
    "Regulatory licences (India launch)", "Insurance certificates (current)",
    "Lightning Strike vendor MoU (signed)",
  ],
  technology_direction: [
    "Architecture Decision Records (ADRs)", "Latest security audit",
    "Penetration test report (last 12mo)", "SLA register (uptime targets)",
    "Vendor risk register", "Incident post-mortems (last 90d)",
    "API contracts (external + internal)", "Infrastructure cost map (AWS/GCP)",
  ],
  product_strategy: [
    "Roadmap with dated milestones", "Customer-research synthesis (last quarter)",
    "Churn / retention analysis", "Feature-usage telemetry export",
    "NPS / CSAT report", "Live PRDs (current sprint)",
  ],
  investor_board: [
    "Latest board deck (final)", "Investor update emails (last 3)",
    "KPI dashboard snapshots (monthly)", "Capital strategy memo",
    "Term sheet (latest round)", "409A valuation (if US)",
    "Board minutes (last 2 meetings)",
  ],
  operations: [
    "Org chart with comp bands", "Succession plan (top 10 roles)",
    "Performance calibration grid", "Hiring plan vs actual",
    "Attrition log (rolling 12mo)", "Operations runbook",
  ],
  recruitment: [
    "Hiring funnel conversion report", "Interviewer scorecards",
    "Comp benchmarking data",
  ],
};

// ─── Leadership Roster — direct reports Duncan MUST assess every briefing ──
const LEADERSHIP_ROSTER: Array<{
  name: string;
  role: string;
  aliases: string[];
  owns_priorities?: string[];
}> = [
  { name: "Nimesh", role: "CEO", aliases: ["nimesh", "nimesh patel"], owns_priorities: ["lightning_strike"] },
  { name: "Patrick", role: "CFO", aliases: ["patrick", "patrick badenoch"], owns_priorities: ["preorders"] },
  { name: "Ellaine", role: "COO / General Counsel", aliases: ["ellaine"] },
  { name: "Matt", role: "CPO", aliases: ["matt"], owns_priorities: ["team_selection"] },
  { name: "Alex", role: "CMO", aliases: ["alex"], owns_priorities: ["kpl_registrations", "preorders"] },
  { name: "Simon", role: "Operations Director", aliases: ["simon", "simon wood"], owns_priorities: ["lightning_strike", "trials", "team_selection"] },
  { name: "Palash", role: "Head of Duncan", aliases: ["palash", "palash soundarkar"], owns_priorities: ["duncan_automation"] },
  { name: "Parmy", role: "CTO", aliases: ["parmy", "parmy virk"] },
];

// Per-leader signal tally — deterministic, server-authoritative.
function computeLeaderSignalMap(input: {
  meetings: Array<{ title: string | null; participants?: string[] | null; summary: string | null; meeting_date: string | null }>;
  cards: Array<{ title: string | null; owner_id?: string | null }>;
  workItems: Array<{ title: string | null; assigned_to?: string | null }>;
  releases: Array<{ title: string | null; version: string | null; published_at: string | null }>;
  profiles: Array<{ display_name: string | null }>;
}) {
  const norm = (s: string) => s.toLowerCase().trim();
  return LEADERSHIP_ROSTER.map((leader) => {
    const aliases = leader.aliases.map(norm);
    const matchAny = (h: string | null | undefined) => {
      if (!h) return false;
      const s = norm(String(h));
      return aliases.some((a) => s.includes(a));
    };

    const meetingHits = (input.meetings || []).filter((m) => {
      const partHit = Array.isArray(m.participants) && m.participants.some((p) => matchAny(p));
      return partHit || matchAny(m.summary) || matchAny(m.title);
    });
    const cardHits = (input.cards || []).filter((c) => {
      const ownerName = (input.profiles || []).find((p) => norm(String(p.display_name || "")) === norm(String(c.owner_id || "")))?.display_name;
      return matchAny(ownerName as string | null) || matchAny(c.title);
    });
    const azureHits = (input.workItems || []).filter((w) => matchAny(w.assigned_to) || matchAny(w.title));
    const releaseHits = (input.releases || []).filter((r) => matchAny(r.title));

    const sources: string[] = [];
    if (meetingHits.length) sources.push("meetings");
    if (cardHits.length) sources.push("workstreams");
    if (azureHits.length) sources.push("azure");
    if (releaseHits.length) sources.push("releases");

    const signal_status: "active" | "low_signal" | "silent" =
      sources.length >= 2 ? "active" : sources.length === 1 ? "low_signal" : "silent";

    return {
      name: leader.name,
      role: leader.role,
      owns_priorities: leader.owns_priorities ?? [],
      signal_status,
      sources,
      counts: {
        meetings: meetingHits.length,
        workstreams: cardHits.length,
        azure: azureHits.length,
        releases: releaseHits.length,
      },
      sources_detail: {
        meetings: meetingHits.slice(0, 3).map((m) => ({ title: m.title, date: m.meeting_date })),
        workstreams: cardHits.slice(0, 3).map((c) => ({ title: c.title })),
        azure: azureHits.slice(0, 3).map((w) => ({ title: w.title })),
        releases: releaseHits.slice(0, 3).map((r) => ({ title: r.title, version: r.version })),
      },
    };
  });
}

// ─── Cross-system signal inference — what evidence in OTHER systems implies a doc should exist ──
function inferArtifactSignals(input: {
  meetings: Array<{ title: string | null; meeting_date: string | null; summary: string | null }>;
  recentTranscripts: Array<{ title: string; meeting_date: string | null; transcript: string | null }>;
  xeroInvoices: Array<{ contact_name: string | null; total: number | null; date: string | null }>;
  workItems: Array<{ title: string | null; tags?: string | null }>;
  releases: Array<{ title: string | null; version: string | null; published_at: string | null }>;
}) {
  const signals: Array<{ inferred_artifact: string; domain: string; source: string; hint: string }> = [];
  const seen = new Set<string>();
  const push = (s: { inferred_artifact: string; domain: string; source: string; hint: string }) => {
    const k = `${s.domain}::${s.inferred_artifact}`;
    if (seen.has(k)) return;
    seen.add(k);
    signals.push(s);
  };

  // Meetings — keyword → artifact
  const meetingHaystack = [...input.meetings, ...input.recentTranscripts].map((m: any) => ({
    title: String(m.title || ""),
    date: m.meeting_date || null,
    text: `${m.title || ""} ${m.summary || ""} ${m.transcript ? String(m.transcript).slice(0, 4000) : ""}`.toLowerCase(),
  }));
  const meetingRules: Array<{ kw: string[]; domain: string; artifact: string }> = [
    { kw: ["india launch", "lightning strike", "vendor mou"], domain: "legal", artifact: "Signed Lightning Strike India vendor MoU" },
    { kw: ["board", "investor update", "investor call"], domain: "investor_board", artifact: "Latest board deck / investor update" },
    { kw: ["fundraise", "round", "term sheet"], domain: "investor_board", artifact: "Active term sheet + capital strategy memo" },
    { kw: ["security", "pentest", "pen test", "vulnerability"], domain: "technology_direction", artifact: "Penetration test report + remediation plan" },
    { kw: ["architecture", "platform redesign", "rearchitect"], domain: "technology_direction", artifact: "Architecture Decision Record (ADR)" },
    { kw: ["customer research", "user interview", "discovery call"], domain: "product_strategy", artifact: "Customer-research synthesis" },
    { kw: ["budget", "burn", "runway", "cash"], domain: "finance_planning", artifact: "13-week cash forecast + runway model" },
    { kw: ["nda", "non-disclosure"], domain: "legal", artifact: "Signed NDAs register" },
    { kw: ["hire", "headcount", "comp band"], domain: "operations", artifact: "Hiring plan vs actual + comp bands" },
  ];
  for (const m of meetingHaystack) {
    for (const r of meetingRules) {
      if (r.kw.some((k) => m.text.includes(k))) {
        push({
          inferred_artifact: r.artifact,
          domain: r.domain,
          source: `meeting:${m.title.slice(0, 60)}`,
          hint: `Mentioned in "${m.title.slice(0, 60)}"${m.date ? ` (${m.date.slice(0, 10)})` : ""} — likely with the participants of that meeting.`,
        });
      }
    }
  }

  // Xero — large/recurring vendor payments → vendor contracts should exist
  const vendorTotals = new Map<string, number>();
  for (const inv of input.xeroInvoices) {
    if (!inv.contact_name || typeof inv.total !== "number") continue;
    vendorTotals.set(inv.contact_name, (vendorTotals.get(inv.contact_name) || 0) + Math.abs(inv.total));
  }
  for (const [vendor, total] of vendorTotals.entries()) {
    if (total < 1000) continue;
    const lower = vendor.toLowerCase();
    if (/aws|amazon web|gcp|google cloud|azure/.test(lower)) {
      push({ inferred_artifact: `Infrastructure contract + cost map (${vendor})`, domain: "technology_direction", source: `xero:${vendor}`, hint: `Recurring spend with ${vendor} (~£${Math.round(total)} in window) — vendor contract should be on file.` });
    } else if (/lawyer|legal|solicitor/.test(lower)) {
      push({ inferred_artifact: `Legal engagement letter (${vendor})`, domain: "legal", source: `xero:${vendor}`, hint: `Active legal spend with ${vendor} — engagement letter should be uploaded.` });
    } else if (total > 10000) {
      push({ inferred_artifact: `Vendor MSA / contract (${vendor})`, domain: "legal", source: `xero:${vendor}`, hint: `Material spend with ${vendor} (~£${Math.round(total)}) — supplier MSA expected.` });
    }
  }

  // Azure work items — security/compliance tags
  for (const w of input.workItems) {
    const blob = `${w.title || ""} ${w.tags || ""}`.toLowerCase();
    if (/security|pentest|vuln|cve/.test(blob)) {
      push({ inferred_artifact: "Latest security audit + pen-test report", domain: "technology_direction", source: `azure:${(w.title || "").slice(0, 60)}`, hint: `Security work in flight — audit/pen-test artefacts should back this up.` });
    }
    if (/compliance|gdpr|dpa|iso/.test(blob)) {
      push({ inferred_artifact: "Compliance evidence pack (GDPR/DPA/ISO)", domain: "legal", source: `azure:${(w.title || "").slice(0, 60)}`, hint: `Compliance work in flight — DPAs and audit evidence should be uploaded.` });
    }
  }

  // Releases — customer-facing → research synthesis expected
  for (const r of input.releases) {
    if (r.title) {
      push({
        inferred_artifact: `Customer-research synthesis behind "${r.title}"`,
        domain: "product_strategy",
        source: `release:${r.version || r.title}`,
        hint: `Released "${r.title}"${r.published_at ? ` on ${r.published_at.slice(0, 10)}` : ""} — discovery research should justify it.`,
      });
    }
  }

  return signals.slice(0, 40);
}

type DomainStatus = "green" | "yellow" | "red";

// ─── Strategic Artifact Matrix ────────────────────────────────────────────
// What documents/feeds Duncan MUST see to give honest advice on each 2026
// priority within each knowledge domain. This is the DENOMINATOR for coverage —
// without it, "Green" only ever means "we have a heartbeat", not "we are ready".
// Critical domains are: operations, finance_planning, legal, technology_direction.
// Empty arrays = this priority does not require artifacts in this domain.
const STRATEGIC_ARTIFACT_MATRIX: Record<string, Record<string, string[]>> = {
  lightning_strike: {
    operations: ["India launch runbook", "On-ground ops plan", "Supply-chain readiness", "Event-day escalation matrix"],
    finance_planning: ["Launch P&L", "India landed-cost model", "FX hedge plan"],
    finance_transactions: ["India vendor payment register"],
    legal: ["India entity docs", "Lightning Strike vendor MoU", "Data-residency review", "Event insurance certificate", "India regulatory licences"],
    technology_direction: ["Launch-day infra capacity plan", "India CDN/edge plan", "Launch incident runbook"],
    product_strategy: ["Launch SKU spec", "Packaging artwork sign-off"],
    investor_board: ["Launch-readiness board memo"],
    recruitment: [],
  },
  kpl_registrations: {
    operations: ["Registration funnel ops plan", "Support staffing model"],
    finance_planning: ["CAC budget by channel", "Paid-media forecast"],
    finance_transactions: ["Marketing spend register"],
    legal: ["KPL terms & conditions", "Privacy policy (registrations)"],
    technology_direction: ["Registration platform load plan", "Anti-fraud / bot-mitigation plan"],
    product_strategy: ["Registration UX flow", "Conversion telemetry plan"],
    investor_board: ["KPL traction update memo"],
    recruitment: [],
  },
  trials: {
    operations: ["Trials operations plan (Oct/Nov)", "Trials venue logistics", "Trials staffing rota"],
    finance_planning: ["Trials cost model"],
    finance_transactions: [],
    legal: ["Trials participant waiver", "Venue insurance", "Safeguarding policy"],
    technology_direction: ["Trials scoring system spec"],
    product_strategy: ["Trials format & criteria document"],
    investor_board: [],
    recruitment: ["Trials judge / coach roster"],
  },
  team_selection: {
    operations: ["Selection-day runbook", "10 Super Coaches onboarding plan"],
    finance_planning: ["Coach compensation model"],
    finance_transactions: [],
    legal: ["Super Coach contracts (template)", "Image rights agreements"],
    technology_direction: ["Selection scoring & data pipeline"],
    product_strategy: ["Selection criteria framework", "Coach role definition"],
    investor_board: ["Selection outcomes board memo"],
    recruitment: ["Coach scouting pipeline"],
  },
  preorders: {
    operations: ["Pre-order fulfilment plan", "Logistics & 3PL readiness"],
    finance_planning: ["Pre-order revenue forecast", "Inventory funding plan"],
    finance_transactions: ["Pre-order payment processing setup"],
    legal: ["Pre-order T&Cs", "Refund policy", "Payment processor agreement"],
    technology_direction: ["E-commerce platform readiness", "Payment infra scaling plan"],
    product_strategy: ["Pre-order SKU & pricing matrix"],
    investor_board: ["100k pre-orders commercial memo"],
    recruitment: [],
  },
  duncan_automation: {
    operations: ["Automation roadmap (25%)", "Process inventory & automation candidates"],
    finance_planning: ["Automation ROI / opex savings model"],
    finance_transactions: [],
    legal: ["AI usage / data policy", "Automation vendor agreements"],
    technology_direction: ["Duncan architecture document", "Agent capability map", "AI safety & guardrails plan"],
    product_strategy: ["Automation product roadmap"],
    investor_board: ["Operating-leverage thesis update"],
    recruitment: [],
  },
};

// Normalise a string for fuzzy artifact matching.
const _normToken = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Does any of the supplied strings (file names, card titles, etc.) plausibly
// match the required artifact name? Token-overlap heuristic — must share at
// least 2 distinctive (length>=4) tokens, OR contain the full normalised name.
function _findArtifactMatch(required: string, hay: Array<{ source: string; text: string }>) {
  const reqNorm = _normToken(required);
  if (!reqNorm) return null;
  const reqTokens = reqNorm.split(" ").filter((t) => t.length >= 4);
  if (reqTokens.length === 0) {
    const hit = hay.find((h) => h.text.includes(reqNorm));
    return hit ? { source: hit.source, matched_text: hit.text.slice(0, 80) } : null;
  }
  // Strong: full-name substring
  const strong = hay.find((h) => h.text.includes(reqNorm));
  if (strong) return { source: strong.source, matched_text: strong.text.slice(0, 80) };
  // Weak: ≥2 distinctive tokens overlap
  for (const h of hay) {
    let overlap = 0;
    for (const t of reqTokens) if (h.text.includes(t)) overlap++;
    if (overlap >= 2 && overlap >= Math.ceil(reqTokens.length * 0.5)) {
      return { source: h.source, matched_text: h.text.slice(0, 80) };
    }
  }
  return null;
}

function computeDataCoverage(
  projectFiles: Array<{ file_name: string | null }>,
  meetings: Array<{ title: string | null }>,
  flags: {
    hasOperations: boolean;
    hasRecruitment: boolean;
    hasXero: boolean;
    hasReleases: boolean;
    hasAzureMilestones: boolean;
  },
  signalSources?: {
    cards: Array<{ title: string | null; project_tag?: string | null }>;
    workItems: Array<{ title: string | null; project_name?: string | null }>;
    xeroInvoices: Array<{ contact_name: string | null; invoice_number?: string | null }>;
  },
) {
  const haystack: string[] = [];
  for (const f of projectFiles) if (f?.file_name) haystack.push(String(f.file_name).toLowerCase());
  for (const m of meetings) if (m?.title) haystack.push(String(m.title).toLowerCase());

  // Build a richer haystack used by the strategic-artifact fuzzy matcher.
  // Each entry is tagged with its source so we can show "likely_supplied_as".
  const richHay: Array<{ source: string; text: string }> = [];
  for (const f of projectFiles) {
    if (f?.file_name) richHay.push({ source: `file:${f.file_name}`, text: _normToken(f.file_name) });
  }
  for (const m of meetings) {
    if (m?.title) richHay.push({ source: `meeting:${m.title}`, text: _normToken(m.title) });
  }
  if (signalSources) {
    for (const c of signalSources.cards || []) {
      const t = c.title || c.project_tag;
      if (t) richHay.push({ source: `card:${t}`, text: _normToken(t) });
    }
    for (const w of signalSources.workItems || []) {
      const t = w.title || w.project_name;
      if (t) richHay.push({ source: `azure:${t}`, text: _normToken(t) });
    }
    for (const inv of signalSources.xeroInvoices || []) {
      const t = inv.contact_name || inv.invoice_number;
      if (t) richHay.push({ source: `xero:${t}`, text: _normToken(t) });
    }
  }

  const matchAny = (aliases: readonly string[]) => {
    if (!aliases.length) return [];
    const hits: string[] = [];
    for (const a of aliases) {
      const al = a.toLowerCase();
      if (haystack.some((h) => h.includes(al))) hits.push(a);
    }
    return hits;
  };

  // ─── 1. Build per-priority × per-domain strategic coverage ─────────────
  type DomainArtifactRow = {
    domain: string;
    domain_label: string;
    required: string[];
    supplied: Array<{ name: string; likely_supplied_as: string; source: string }>;
    missing: string[];
  };
  type PriorityCoverage = {
    priority_id: string;
    priority_title: string;
    coverage_pct: number;
    status: DomainStatus;
    by_domain: DomainArtifactRow[];
    total_required: number;
    total_supplied: number;
  };
  const domainLabelById = new Map(KNOWLEDGE_DOMAINS.map((d) => [d.id, d.label]));
  const strategic_coverage: PriorityCoverage[] = PRIORITY_DEFINITIONS.map((p) => {
    const domainMap = STRATEGIC_ARTIFACT_MATRIX[p.id] || {};
    const by_domain: DomainArtifactRow[] = [];
    let totalReq = 0;
    let totalSup = 0;
    for (const d of KNOWLEDGE_DOMAINS) {
      const required = domainMap[d.id] || [];
      if (required.length === 0) continue;
      const supplied: DomainArtifactRow["supplied"] = [];
      const missing: string[] = [];
      for (const art of required) {
        const m = _findArtifactMatch(art, richHay);
        if (m) {
          supplied.push({ name: art, likely_supplied_as: m.matched_text, source: m.source });
        } else {
          missing.push(art);
        }
      }
      totalReq += required.length;
      totalSup += supplied.length;
      by_domain.push({
        domain: d.id,
        domain_label: d.label,
        required,
        supplied,
        missing,
      });
    }
    const pct = totalReq > 0 ? Math.round((totalSup / totalReq) * 100) : 0;
    let status: DomainStatus = "red";
    if (pct >= 70) status = "green";
    else if (pct >= 40) status = "yellow";
    return {
      priority_id: p.id,
      priority_title: p.title,
      coverage_pct: pct,
      status,
      by_domain,
      total_required: totalReq,
      total_supplied: totalSup,
    };
  });

  // ─── 2. Per-domain strategic rollup (denominator across all priorities) ─
  const CRITICAL_DOMAIN_IDS = new Set(["operations", "finance_planning", "legal", "technology_direction"]);
  const strategicByDomain = new Map<string, {
    required_total: number;
    supplied_total: number;
    blind_priorities: string[]; // priority titles with 0 supplied in this domain
    missing_artifacts: Set<string>;
  }>();
  for (const d of KNOWLEDGE_DOMAINS) {
    strategicByDomain.set(d.id, { required_total: 0, supplied_total: 0, blind_priorities: [], missing_artifacts: new Set() });
  }
  for (const pc of strategic_coverage) {
    for (const dr of pc.by_domain) {
      const agg = strategicByDomain.get(dr.domain);
      if (!agg) continue;
      agg.required_total += dr.required.length;
      agg.supplied_total += dr.supplied.length;
      for (const m of dr.missing) agg.missing_artifacts.add(m);
      if (dr.required.length > 0 && dr.supplied.length === 0) {
        agg.blind_priorities.push(pc.priority_title);
      }
    }
  }

  // ─── 3. Per-domain status — strategic coverage drives it, with critical floor ─
  const domains = KNOWLEDGE_DOMAINS.map((d) => {
    const agg = strategicByDomain.get(d.id)!;
    const pct = agg.required_total > 0 ? Math.round((agg.supplied_total / agg.required_total) * 100) : 0;
    let status: DomainStatus;
    if (agg.required_total === 0) {
      // No strategic artifacts mapped — fall back to old heartbeat logic.
      const matchedAliases = matchAny(d.file_aliases);
      if (d.id === "recruitment") {
        status = flags.hasRecruitment ? "green" : "red";
      } else if (d.id === "finance_transactions") {
        status = flags.hasXero ? "green" : "red";
      } else if (matchedAliases.length >= 2) status = "green";
      else if (matchedAliases.length >= 1) status = "yellow";
      else status = "red";
    } else {
      if (pct >= 70) status = "green";
      else if (pct >= 40) status = "yellow";
      else status = "red";
      // Critical-priority floor: if any priority has 0 artifacts in a critical
      // domain, force RED — strategic blind spot regardless of overall %.
      if (CRITICAL_DOMAIN_IDS.has(d.id) && agg.blind_priorities.length > 0) {
        status = "red";
      }
    }

    // Live-signal chip (heartbeat) — rendered separately, no longer drives status.
    let live_signal: "active" | "quiet" = "quiet";
    if (d.id === "operations") live_signal = flags.hasOperations ? "active" : "quiet";
    else if (d.id === "recruitment") live_signal = flags.hasRecruitment ? "active" : "quiet";
    else if (d.id === "finance_transactions") live_signal = flags.hasXero ? "active" : "quiet";
    else if (d.id === "technology_direction") live_signal = (flags.hasReleases || flags.hasAzureMilestones) ? "active" : "quiet";
    else live_signal = matchAny(d.file_aliases).length > 0 ? "active" : "quiet";

    const matched = matchAny(d.file_aliases);
    const evidenceParts: string[] = [];
    if (agg.required_total > 0) {
      evidenceParts.push(`${agg.supplied_total} / ${agg.required_total} strategic artifacts (${pct}%).`);
      if (agg.blind_priorities.length > 0) {
        evidenceParts.push(`Blind for: ${agg.blind_priorities.slice(0, 3).join(", ")}.`);
      }
    }
    if (matched.length > 0) evidenceParts.push(`File aliases matched: ${matched.slice(0, 2).join(", ")}.`);
    if (evidenceParts.length === 0) evidenceParts.push(`No strategic artifacts mapped — ${d.needs.toLowerCase()}.`);

    return {
      id: d.id,
      label: d.label,
      status,
      critical: d.critical,
      needs: d.needs,
      evidence: evidenceParts.join(" "),
      matched_signals: matched,
      recommendation: status === "green" ? null : d.upload_hint,
      prefill_tag: d.prefill_tag,
      // New strategic + heartbeat fields
      strategic_required: agg.required_total,
      strategic_supplied: agg.supplied_total,
      strategic_pct: pct,
      blind_priorities: agg.blind_priorities,
      missing_artifacts: Array.from(agg.missing_artifacts).slice(0, 12),
      live_signal,
    };
  });

  const reds = domains.filter((d) => d.status === "red");
  const yellows = domains.filter((d) => d.status === "yellow");
  const criticalReds = reds.filter((d) => d.critical);
  const finPlanRed = reds.some((d) => d.id === "finance_planning");
  const techDirRed = reds.some((d) => d.id === "technology_direction");

  // ─── 4. Confidence cap — strategic-coverage average + red-count floor ───
  const overall_strategic_pct = strategic_coverage.length > 0
    ? Math.round(strategic_coverage.reduce((s, p) => s + p.coverage_pct, 0) / strategic_coverage.length)
    : 0;
  let strategicCap: "high" | "medium" | "low" = "high";
  if (overall_strategic_pct < 40) strategicCap = "low";
  else if (overall_strategic_pct < 70) strategicCap = "medium";

  let redCap: "high" | "medium" | "low" = "high";
  let redCapReason = "All critical knowledge domains have at least partial coverage.";
  if (reds.length >= 3 || (finPlanRed && techDirRed)) {
    redCap = "low";
    redCapReason = `${reds.length} domain${reds.length === 1 ? "" : "s"} are missing entirely${finPlanRed && techDirRed ? " (including both Finance Planning and Technology Direction)" : ""}.`;
  } else if (criticalReds.length >= 1) {
    redCap = "medium";
    redCapReason = `${criticalReds.length} critical domain${criticalReds.length === 1 ? "" : "s"} (${criticalReds.map((d) => d.label).join(", ")}) are below threshold.`;
  }

  // Whichever is stricter wins.
  const capRank = { high: 0, medium: 1, low: 2 } as const;
  const confidence_cap = capRank[strategicCap] >= capRank[redCap] ? strategicCap : redCap;
  const cap_reason = confidence_cap === strategicCap && strategicCap !== "high"
    ? `Strategic artifact coverage is only ${overall_strategic_pct}% across the 6 priorities. ${redCapReason}`
    : `${redCapReason} Strategic coverage average: ${overall_strategic_pct}%.`;

  const worstRed = criticalReds[0] || reds[0] || null;

  return {
    domains,
    counts: { red: reds.length, yellow: yellows.length, green: domains.length - reds.length - yellows.length, total: domains.length },
    confidence_cap,
    cap_reason,
    worst_red_domain: worstRed ? { id: worstRed.id, label: worstRed.label, recommendation: worstRed.recommendation } : null,
    critical_reds: criticalReds.map((d) => ({ id: d.id, label: d.label, recommendation: d.recommendation })),
    strategic_coverage,
    overall_strategic_pct,
  };
}

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
      // Data Coverage Audit inputs
      projectFiles, allMeetingTitles,
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
      safe(admin.from("token_usage").select("user_id,total_tokens,prompt_tokens,completion_tokens,request_count,usage_date").gte("usage_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).limit(5000)),
      safe(admin.from("xero_invoices").select("invoice_number,contact_name,total,amount_due,amount_paid,status,type,due_date,date").gte("synced_at", since).order("date", { ascending: false }).limit(40)),
      safe(admin.from("xero_contacts").select("name,outstanding_balance,overdue_balance").gt("overdue_balance", 0).order("overdue_balance", { ascending: false }).limit(15)),
      safe(admin.from("integration_audit_logs").select("integration,action,details,created_at").gte("created_at", since).limit(40)),
      safe(admin.from("workstream_cards").select("title,project_tag").is("archived_at", null).limit(500)),
      safe(admin.from("azure_work_items").select("title,project_name").limit(500)),
      safe(admin.from("meetings").select("title,meeting_date,transcript").not("transcript", "is", null).order("meeting_date", { ascending: false }).limit(10)),
      safe(admin.from("project_files").select("id,file_name,created_at,extracted_text").order("created_at", { ascending: false }).limit(1000)),
      safe(admin.from("meetings").select("title").order("meeting_date", { ascending: false }).limit(200)),
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

    // ─── Cross-system inferred-artifact signals (Chief-of-Staff reasoning) ─
    const inferred_artifact_signals = inferArtifactSignals({
      meetings: meetings as any[],
      recentTranscripts: recentTranscripts as any[],
      xeroInvoices: xeroInvoices as any[],
      workItems: workItems as any[],
      releases: releases as any[],
    });

    // ─── Company-wide email pulse (opt-in mailboxes, last 24h) ────
    let email_pulse: any = null;
    try {
      const epRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/ceo-email-pulse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({}),
        },
      );
      if (epRes.ok) {
        email_pulse = await epRes.json();
      } else {
        console.warn("ceo-email-pulse non-200:", epRes.status);
      }
    } catch (e) {
      console.warn("ceo-email-pulse invoke failed:", e);
    }

    // ─── Leadership signal map (deterministic, per-leader tally) ───
    const leader_signal_map = computeLeaderSignalMap({
      meetings: meetings as any[],
      cards: cards as any[],
      workItems: workItems as any[],
      releases: releases as any[],
      profiles: profiles as any[],
    });


    const data_coverage_audit = computeDataCoverage(
      (projectFiles as any[]) || [],
      (allMeetingTitles as any[]) || [],
      {
        hasOperations: ((cards as any[]).length + (workItems as any[]).length + (meetings as any[]).length) > 0,
        hasRecruitment: (candidates as any[]).length > 0,
        hasXero: ((xeroInvoices as any[]).length + (xeroContacts as any[]).length) > 0,
        hasReleases: (releases as any[]).length > 0,
        hasAzureMilestones: (workItems as any[]).some((w: any) => /milestone|release/i.test(String(w.title || ""))),
      },
      {
        cards: (allCards as any[]) || [],
        workItems: (allWorkItems as any[]) || [],
        xeroInvoices: (xeroInvoices as any[]) || [],
      },
    );

    // ─── Domain File Review — actually READ uploaded docs (not just names) ─
    type DomainFileReview = {
      domain_id: string;
      domain_label: string;
      files_inspected: Array<{ name: string; last_updated: string | null; chunks_read: number; byte_size: number }>;
      content_excerpt: string;
    };
    const domain_file_review: DomainFileReview[] = [];
    const allFiles = (projectFiles as any[]) || [];
    const PER_FILE_CHAR_CAP = 6000;
    const PER_DOMAIN_CHAR_CAP = 6000;
    const TOTAL_CHAR_CAP = 30000;
    let totalChars = 0;

    for (const d of KNOWLEDGE_DOMAINS) {
      if (!d.file_aliases.length) continue;
      if (totalChars >= TOTAL_CHAR_CAP) break;
      const aliases = d.file_aliases.map((a) => a.toLowerCase());
      const matchedFiles = allFiles
        .filter((f: any) => f?.file_name && aliases.some((a) => String(f.file_name).toLowerCase().includes(a)))
        .slice(0, 2);
      if (matchedFiles.length === 0) continue;

      const inspected: DomainFileReview["files_inspected"] = [];
      const excerptParts: string[] = [];
      let domainChars = 0;

      for (const f of matchedFiles) {
        if (domainChars >= PER_DOMAIN_CHAR_CAP || totalChars >= TOTAL_CHAR_CAP) break;
        let chunkText = "";
        let chunksRead = 0;
        try {
          const { data: chunks } = await admin
            .from("project_file_chunks")
            .select("content,chunk_index")
            .eq("file_id", f.id)
            .order("chunk_index", { ascending: true })
            .limit(3);
          if (chunks && chunks.length > 0) {
            chunkText = chunks.map((c: any) => c.content || "").filter(Boolean).join("\n\n").slice(0, PER_FILE_CHAR_CAP);
            chunksRead = chunks.length;
          }
        } catch { /* ignore */ }
        if (!chunkText && typeof f.extracted_text === "string") {
          chunkText = f.extracted_text.slice(0, PER_FILE_CHAR_CAP);
          chunksRead = chunkText ? 1 : 0;
        }
        if (!chunkText) continue;

        const remaining = Math.min(PER_DOMAIN_CHAR_CAP - domainChars, TOTAL_CHAR_CAP - totalChars);
        const slice = chunkText.slice(0, remaining);
        excerptParts.push(`[${f.file_name}]\n${slice}`);
        inspected.push({
          name: f.file_name,
          last_updated: f.created_at ?? null,
          chunks_read: chunksRead,
          byte_size: slice.length,
        });
        domainChars += slice.length;
        totalChars += slice.length;
      }

      if (inspected.length > 0) {
        domain_file_review.push({
          domain_id: d.id,
          domain_label: d.label,
          files_inspected: inspected,
          content_excerpt: excerptParts.join("\n\n---\n\n"),
        });
      }
    }

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

    // Pre-compute the server-authoritative coverage summary so the model can quote it verbatim.
    const _preCovered = coverage_report.filter((c) => c.status === "covered");
    const _preMissing = coverage_report.filter((c) => c.status === "missing");
    const _preTotal = PRIORITY_DEFINITIONS.length;
    const _preRatio = _preCovered.length / _preTotal;
    const coverage_summary_authoritative = {
      covered: _preCovered.length,
      total: _preTotal,
      ratio: Number(_preRatio.toFixed(2)),
      ratio_pct: Math.round(_preRatio * 100),
      covered_priorities: _preCovered.map((c) => ({ priority: c.priority, matched_workstream: c.matched_workstream })),
      missing_priorities: _preMissing.map((m) => m.priority),
    };

    // ─── Automation & Leverage signals (last 30d, deterministic) ──
    // Aggregates token_usage rows + joins profiles + lightweight surface
    // counts so Section 07 can be grounded, not hallucinated.
    const automation_leverage = await (async () => {
      const rows = (tokenUsage as any[]) || [];
      const today = new Date();
      const dayKey = (d: Date) => d.toISOString().slice(0, 10);
      const keys30 = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today.getTime() - i * 86400000);
        keys30.add(dayKey(d));
      }

      // Aggregate per-user totals over last 30d
      const perUser = new Map<string, { total_tokens: number; request_count: number }>();
      let total_tokens = 0;
      let request_count = 0;
      for (const r of rows) {
        if (!keys30.has(String(r.usage_date))) continue;
        const t = Number(r.total_tokens) || 0;
        const rc = Number(r.request_count) || 0;
        total_tokens += t;
        request_count += rc;
        const cur = perUser.get(r.user_id) || { total_tokens: 0, request_count: 0 };
        cur.total_tokens += t;
        cur.request_count += rc;
        perUser.set(r.user_id, cur);
      }
      const active_users = perUser.size;

      // Trend buckets: today vs yesterday, last 7d vs prior 7d
      const todayKey = dayKey(today);
      const yesterdayKey = dayKey(new Date(today.getTime() - 86400000));
      let todayTokens = 0, yesterdayTokens = 0;
      let last7 = 0, prior7 = 0;
      for (const r of rows) {
        const d = String(r.usage_date);
        const t = Number(r.total_tokens) || 0;
        if (d === todayKey) todayTokens += t;
        if (d === yesterdayKey) yesterdayTokens += t;
        const dt = new Date(d).getTime();
        const ageDays = Math.floor((today.getTime() - dt) / 86400000);
        if (ageDays >= 0 && ageDays < 7) last7 += t;
        else if (ageDays >= 7 && ageDays < 14) prior7 += t;
      }
      const pctChange = (cur: number, prev: number) =>
        prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
      const dow_change_pct = pctChange(todayTokens, yesterdayTokens);
      const wow_change_pct = pctChange(last7, prior7);
      let trend_label: string = "Insufficient data";
      if (last7 + prior7 > 0) {
        if (wow_change_pct >= 25) trend_label = "Adoption accelerating";
        else if (wow_change_pct >= 5) trend_label = "Adoption steady";
        else if (wow_change_pct > -10) trend_label = "Flat";
        else trend_label = "Declining";
      }

      // Top 3 users
      const top3 = Array.from(perUser.entries())
        .sort((a, b) => b[1].total_tokens - a[1].total_tokens)
        .slice(0, 3);
      const topUserIds = top3.map(([uid]) => uid);

      // Surface counts (parallel, capped) — used to infer "primary_use"
      const [generalChats, projectChats, gmailProfiles] = await Promise.all([
        safe(admin.from("general_chats").select("user_id").in("user_id", topUserIds.length ? topUserIds : ["00000000-0000-0000-0000-000000000000"])),
        safe(admin.from("project_chats").select("project_id, projects!inner(user_id)").in("projects.user_id", topUserIds.length ? topUserIds : ["00000000-0000-0000-0000-000000000000"])),
        safe(admin.from("gmail_writing_profiles").select("user_id, auto_drafts_created_today, auto_draft_enabled").in("user_id", topUserIds.length ? topUserIds : ["00000000-0000-0000-0000-000000000000"])),
      ]);

      const profilesByUserId = new Map<string, any>();
      for (const pr of (profiles as any[]) || []) {
        if (pr.user_id) profilesByUserId.set(pr.user_id, pr);
      }
      // The profiles fetch above doesn't include user_id — re-fetch with user_id for top users
      const topProfiles = topUserIds.length
        ? await safe(admin.from("profiles").select("user_id, display_name, role_title, department").in("user_id", topUserIds))
        : [];
      const topProfileMap = new Map<string, any>();
      for (const pr of topProfiles as any[]) topProfileMap.set(pr.user_id, pr);

      const generalChatCount = new Map<string, number>();
      for (const g of (generalChats as any[]) || []) {
        generalChatCount.set(g.user_id, (generalChatCount.get(g.user_id) || 0) + 1);
      }
      const projectChatCount = new Map<string, number>();
      for (const pc of (projectChats as any[]) || []) {
        const uid = pc?.projects?.user_id;
        if (uid) projectChatCount.set(uid, (projectChatCount.get(uid) || 0) + 1);
      }
      const gmailDraftMap = new Map<string, { drafts: number; enabled: boolean }>();
      for (const gp of (gmailProfiles as any[]) || []) {
        gmailDraftMap.set(gp.user_id, {
          drafts: Number(gp.auto_drafts_created_today) || 0,
          enabled: Boolean(gp.auto_draft_enabled),
        });
      }

      const inferPrimaryUse = (uid: string): string => {
        const g = generalChatCount.get(uid) || 0;
        const p = projectChatCount.get(uid) || 0;
        const gm = gmailDraftMap.get(uid);
        const surfaces: Array<{ label: string; n: number }> = [
          { label: "general Q&A in Duncan chat", n: g },
          { label: "project workspaces & RAG", n: p },
          { label: "Gmail auto-drafting", n: (gm?.drafts || 0) + (gm?.enabled ? 1 : 0) },
        ];
        surfaces.sort((a, b) => b.n - a.n);
        const dominant = surfaces[0];
        if (!dominant || dominant.n === 0) return "Mixed usage across surfaces";
        return `Primarily ${dominant.label}`;
      };

      const top_users = top3.map(([uid, agg], i) => {
        const pr = topProfileMap.get(uid);
        // Estimate hours saved: tokens → ~4 chars/token → words at ~5 chars → reading at 250 wpm
        const est_hours_saved = Math.round((agg.total_tokens * 4) / 5 / 250 / 60);
        return {
          rank: i + 1,
          name: pr?.display_name || "Unknown user",
          role: pr?.role_title || "—",
          department: pr?.department || "—",
          total_tokens: agg.total_tokens,
          request_count: agg.request_count,
          primary_use: inferPrimaryUse(uid),
          est_hours_saved,
        };
      });

      // Heaviest manual surfaces (company-wide, last 30d) — for recommendation floor
      const totalGmailDrafts = ((gmailProfiles as any[]) || []).reduce(
        (acc, gp) => acc + (Number(gp.auto_drafts_created_today) || 0),
        0,
      );

      return {
        company_usage: {
          total_tokens,
          request_count,
          active_users,
          dow_change_pct,
          wow_change_pct,
          trend_label,
          today_tokens: todayTokens,
          last_7d_tokens: last7,
          prior_7d_tokens: prior7,
        },
        top_users,
        heavy_surfaces: {
          gmail_auto_drafts_today: totalGmailDrafts,
          general_chats_top_users: Array.from(generalChatCount.values()).reduce((a, b) => a + b, 0),
          project_chats_top_users: Array.from(projectChatCount.values()).reduce((a, b) => a + b, 0),
        },
      };
    })();


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
      coverage_summary: coverage_summary_authoritative,
      meeting_priority_signals,
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
      automation_leverage,
      xero_invoices_24h: xeroInvoices,
      xero_overdue_contacts: xeroContacts,
      integration_audit_24h: auditLogs,
      team_directory: profiles,
      domain_file_review,
      operating_system_checklist: OPERATING_SYSTEM_CHECKLIST,
      inferred_artifact_signals,
      leadership_roster: LEADERSHIP_ROSTER.map((l) => ({ name: l.name, role: l.role, owns_priorities: l.owns_priorities ?? [] })),
      leader_signal_map,
      email_pulse_signals: email_pulse?.signals ?? null,
      email_pulse_silent_leaders: email_pulse?.silent_leaders ?? [],
      previous_briefing: (prev as any)?.[0] ?? null,
    };

    const userPrompt = `Generate the ${briefing_type === "evening" ? "EVENING ACCOUNTABILITY" : "MORNING CEO"} BRIEFING.

${briefing_type === "evening" ? EVENING_SCHEMA_HINT : MORNING_SCHEMA_HINT}

SERVER-AUTHORITATIVE COVERAGE (USE THESE NUMBERS VERBATIM):
${JSON.stringify(coverage_summary_authoritative)}

HARD RULES:
- coverage_summary above is server-computed truth. You MUST use these exact numbers (covered/total/ratio_pct) verbatim in payload.company_pulse, payload.brutal_truth, and payload.execution_explanation. Do NOT recompute, infer, estimate, or round coverage in prose.
- Do NOT claim a priority is covered unless it appears in coverage_summary.covered_priorities.
- Use meeting_priority_signals to detect IMPLICIT coverage — work happening on a 2026 priority WITHOUT a formal workstream. For any priority that has signals but no workstream, the corresponding payload.coverage_gaps entry MUST include:
    "current_signal": "<one-sentence summary of what's being discussed in meetings>",
    "signal_sources": [<meeting_title strings>],
    "recommended_action": "Formalise into a workstream — work is already happening but untracked."
  Implicit-coverage gaps are MORE URGENT than silent gaps because momentum exists but is invisible to the system.
- For priorities with NO signal anywhere (no workstream, no meeting mention), set "current_signal": null and "recommended_action": "No activity detected — assign owner immediately."
- email_pulse_signals (when present) is structured intelligence pulled from leaders' inboxes (last 24h). USE IT:
    • Merge email commitments into payload.decisions §9 — flag "source: email" and surface ones with no owner.
    • Add email risks/escalations to payload.risks with "source: email" and a probability_impact_pts that fits the gap.
    • Surface board_mentions in payload.tldr.where_to_act and the investor section if present.
    • If a leader appears in email_pulse_silent_leaders AND in leader_signal_map as silent, ESCALATE their leadership entry to risk_level="high" with output_vs_expectation referencing both meeting and email silence.
- payload.automation_progress MUST be populated for the morning briefing using context.automation_leverage as the GROUND TRUTH:
    • company_usage = automation_leverage.company_usage VERBATIM (do NOT recompute totals, trends, or active_users).
    • top_users = automation_leverage.top_users VERBATIM for rank/name/role/department/total_tokens/request_count/primary_use/est_hours_saved. Do NOT invent users not in this array.
    • recommendations = AT LEAST 3 concrete suggestions for what to improve or build next in Duncan, drawn from: (a) coverage_gaps (e.g. "Auto-ingest missing artifact for {priority}"), (b) headline_context.silent_priorities, (c) friction items where recommended_resolver != "CEO" (automatable handoffs), (d) workstreams stuck Yellow/Red, (e) heaviest manual surfaces in automation_leverage.heavy_surfaces (e.g. high gmail_auto_drafts_today → suggest auto-categorisation). Each recommendation MUST cite the evidence_source from the enum and set auto_injected=false.
    • Keep the legacy "automation" object too (percent/working/manual/next/blockers) — it still feeds the headline number.

Source data (24h activity window; available_workstreams + coverage_report + meeting_priority_signals are full-set):
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
    //    + enrich with meeting_priority_signals to flag implicit (untracked) work.
    parsed.payload = parsed.payload || {};
    const missing = coverage_report.filter((c) => c.status === "missing");
    const covered = coverage_report.filter((c) => c.status === "covered");
    const modelGaps = Array.isArray(parsed.payload.coverage_gaps) ? parsed.payload.coverage_gaps : [];
    const signalsByPriority = new Map(
      meeting_priority_signals.map((s) => [s.priority_id, s])
    );
    parsed.payload.coverage_gaps = missing.map((m) => {
      const fromModel = modelGaps.find((g: any) =>
        (g?.priority || "").toLowerCase().includes(m.priority.toLowerCase().split("—")[0].trim().slice(0, 12))
      );
      const sig = signalsByPriority.get(m.priority_id);
      const hasSignal = !!(sig && sig.mentions.length > 0);
      const signalSources = hasSignal ? sig!.mentions.map((x) => x.meeting_title).slice(0, 5) : [];
      return {
        priority_id: m.priority_id,
        priority: m.priority,
        why_it_matters: fromModel?.why_it_matters || m.why_it_matters,
        consequence_if_unowned: fromModel?.consequence_if_unowned || "No accountable owner means no progress and no escalation path — this priority will silently slip.",
        recommended_owner: fromModel?.recommended_owner || m.expected_owner,
        recommended_workstream_name: fromModel?.recommended_workstream_name || m.priority.split("—")[0].trim(),
        // Implicit-coverage fields (server-authoritative)
        current_signal: hasSignal
          ? (fromModel?.current_signal || `Discussed in ${sig!.mentions.length} recent meeting${sig!.mentions.length === 1 ? "" : "s"} but no formal workstream exists.`)
          : null,
        signal_sources: signalSources,
        signal_status: hasSignal ? ("active_but_untracked" as const) : ("silent" as const),
        recommended_action: hasSignal
          ? "Formalise into a workstream — work is already happening but invisible to Duncan."
          : "No activity detected anywhere — assign owner immediately.",
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

    // 4b. Data Coverage Audit — inject + apply confidence cap
    parsed.payload.data_coverage_audit = data_coverage_audit;
    if (briefing_type === "morning") {
      const cap = data_coverage_audit.confidence_cap;
      if (cap === "medium" || cap === "low") {
        const probCap = cap === "low" ? 30 : 55;
        const execCap = cap === "low" ? 35 : 60;
        if (typeof parsed.outcome_probability !== "number" || parsed.outcome_probability > probCap) parsed.outcome_probability = probCap;
        if (typeof parsed.execution_score !== "number" || parsed.execution_score > execCap) parsed.execution_score = execCap;
        const existing = parsed.payload.confidence_warning || {};
        parsed.payload.confidence_warning = {
          ...existing,
          reason: `${existing.reason ? existing.reason + " " : ""}${data_coverage_audit.cap_reason} (Confidence cap: ${cap}.)`,
          data_coverage_cap: cap,
          data_coverage_cap_reason: data_coverage_audit.cap_reason,
        };
      }
    }

    // 4c. Document Intelligence post-processor — quality downgrades + recap.
    if (briefing_type === "morning") {
      const di = Array.isArray(parsed.payload.document_intelligence) ? parsed.payload.document_intelligence : [];
      // Filter to entries that match a real reviewed domain.
      const reviewedDomainIds = new Set(domain_file_review.map((d) => d.domain_id));
      const cleanDI = di.filter((e: any) => e && typeof e.domain === "string" && reviewedDomainIds.has(e.domain));
      parsed.payload.document_intelligence = cleanDI;

      // Downgrade domain status when the doc is "weak".
      const weakByDomain = new Map<string, any>();
      for (const e of cleanDI) {
        if ((e.verdict || "").toLowerCase() === "weak") weakByDomain.set(e.domain, e);
      }
      let downgraded = false;
      for (const dom of data_coverage_audit.domains) {
        const weak = weakByDomain.get(dom.id);
        if (!weak) continue;
        if (dom.status === "green") { dom.status = "yellow"; downgraded = true; }
        else if (dom.status === "yellow") { dom.status = "red"; downgraded = true; }
        const reason = weak.what_is_missing_in_doc || (weak.contradicted_by?.[0]) || "document is thin or stale";
        dom.evidence = `${dom.label} doc exists (${weak.file_name || "uploaded file"}) but is weak — ${String(reason).slice(0, 200)}.`;
        dom.recommendation = dom.recommendation || `Strengthen ${dom.label}: ${(weak.critical_gaps_to_fix?.[0]) || "fix the gaps Duncan called out"}.`;
      }

      // If status downgrades occurred, recompute the confidence cap.
      if (downgraded) {
        const reds2 = data_coverage_audit.domains.filter((d: any) => d.status === "red");
        const yellows2 = data_coverage_audit.domains.filter((d: any) => d.status === "yellow");
        const critReds2 = reds2.filter((d: any) => d.critical);
        const finPlanRed2 = reds2.some((d: any) => d.id === "finance_planning");
        const techDirRed2 = reds2.some((d: any) => d.id === "technology_direction");
        let cap2: "high" | "medium" | "low" = "high";
        let capReason2 = data_coverage_audit.cap_reason;
        if (reds2.length >= 3 || (finPlanRed2 && techDirRed2)) {
          cap2 = "low";
          capReason2 = `${reds2.length} domains are missing or weak${finPlanRed2 && techDirRed2 ? " (including both Finance Planning and Technology Direction)" : ""}. Duncan cannot honestly project high confidence.`;
        } else if (critReds2.length >= 1) {
          cap2 = "medium";
          capReason2 = `${critReds2.length} critical domain${critReds2.length === 1 ? "" : "s"} (${critReds2.map((d: any) => d.label).join(", ")}) are missing or weak. Confidence capped at medium.`;
        }
        data_coverage_audit.confidence_cap = cap2;
        data_coverage_audit.cap_reason = capReason2;
        data_coverage_audit.counts = {
          red: reds2.length,
          yellow: yellows2.length,
          green: data_coverage_audit.domains.length - reds2.length - yellows2.length,
          total: data_coverage_audit.domains.length,
        };
        // Re-apply caps after downgrade.
        if (cap2 === "medium" || cap2 === "low") {
          const probCap = cap2 === "low" ? 30 : 55;
          const execCap = cap2 === "low" ? 35 : 60;
          if (typeof parsed.outcome_probability !== "number" || parsed.outcome_probability > probCap) parsed.outcome_probability = probCap;
          if (typeof parsed.execution_score !== "number" || parsed.execution_score > execCap) parsed.execution_score = execCap;
        }
      }

      // Ensure the warning banner always reflects the final capped headline values.
      if (parsed.payload.confidence_warning) {
        const finalProb = typeof parsed.outcome_probability === "number" ? parsed.outcome_probability : null;
        const finalExec = typeof parsed.execution_score === "number" ? parsed.execution_score : null;
        const existing = parsed.payload.confidence_warning || {};
        const reasonParts: string[] = [];

        if (coverageRatio < 0.5 && finalProb !== null && finalExec !== null) {
          reasonParts.push(
            `Low-evidence briefing — Duncan can only see ${covered.length} of ${totalPriorities} 2026 priorities. Probability capped at ${finalProb}% and execution at ${finalExec}/100 until missing workstreams are created.`
          );
        }

        if (existing.data_coverage_cap_reason) {
          reasonParts.push(`${existing.data_coverage_cap_reason} (Confidence cap: ${existing.data_coverage_cap || data_coverage_audit.confidence_cap}.)`);
        }

        parsed.payload.confidence_warning = {
          ...existing,
          applied_probability_cap: finalProb ?? existing.applied_probability_cap,
          applied_execution_cap: finalExec ?? existing.applied_execution_cap,
          reason: reasonParts.length > 0 ? reasonParts.join(" ") : existing.reason,
        };
      }

      // Top-line counter on the audit.
      const verdictCounts = { weak: 0, adequate: 0, strong: 0 };
      for (const e of cleanDI) {
        const v = (e.verdict || "").toLowerCase();
        if (v === "weak" || v === "adequate" || v === "strong") verdictCounts[v as keyof typeof verdictCounts]++;
      }
      (data_coverage_audit as any).document_review_summary = {
        documents_reviewed: cleanDI.length,
        ...verdictCounts,
      };
    }

    // 4c-bis. Watchlist deterministic population floor.
    //         The model often returns []. We inject required rows from
    //         non-green workstream_scores, silent priorities, uncovered
    //         coverage domains, and silent leaders owning priorities.
    if (briefing_type === "morning") {
      parsed.payload = parsed.payload || {};
      const wlIn: any[] = Array.isArray(parsed.payload.watchlist) ? [...parsed.payload.watchlist] : [];
      const norm = (s: any) => String(s || "").toLowerCase().trim();
      const hasRowFor = (workstream: string) => {
        const k = norm(workstream);
        if (!k) return false;
        const firstWord = k.split(/[\s—-]+/)[0] || "";
        return wlIn.some((r: any) => {
          const rk = norm(r?.workstream);
          return rk === k || (firstWord && rk.includes(firstWord));
        });
      };

      let watchlistAutoInjected = 0;

      const successCriteriaFor = (priorityTitle: string): string => {
        const pt = priorityTitle.toLowerCase();
        if (pt.includes("lightning")) return "India launch event delivered on 7 June 2026 with signed runbook, vendor contracts and on-the-ground ops plan.";
        if (pt.includes("registration") || pt.includes("kpl")) return "1,000,000 verified KPL registrations with measurable funnel conversion.";
        if (pt.includes("trial")) return "October–November 2026 trials executed across all target cities with attendance + scoring data captured.";
        if (pt.includes("selection") || pt.includes("super coach")) return "Final 10-team / Super Coach selection signed off by December 2026 with publicised roster.";
        if (pt.includes("pre-order") || pt.includes("preorder")) return "100,000 paid pre-orders fulfilled with revenue reconciled in Xero.";
        if (pt.includes("automat") || pt.includes("duncan")) return "25% of company processes measurably automated via Duncan with documented before/after time savings.";
        return "Workstream owner has stated, evidenced, observable definition of done with a date.";
      };

      const expectedOwnerFor = (priorityId: string, fallback?: string): string => {
        const def = PRIORITY_DEFINITIONS.find((p) => p.id === priorityId);
        return def?.expected_owner || fallback || "Cross-functional — escalate to CEO";
      };

      // (a) Non-green workstream_scores → ensure a row exists.
      const wsScores: any[] = Array.isArray(parsed.workstream_scores) ? parsed.workstream_scores : [];
      for (const ws of wsScores) {
        const rag = norm(ws?.rag);
        if (!rag || rag === "green") continue;
        const name = String(ws?.name || "").trim();
        if (!name || hasRowFor(name)) continue;
        const statusLabel = rag === "red" ? "Red" : rag === "yellow" ? "Yellow" : "At Risk";
        wlIn.push({
          workstream: name,
          owner: ws?.owner || "Unassigned — CEO to allocate",
          status: statusLabel,
          good_looks_like: ws?.good_looks_like || successCriteriaFor(name),
          missing: ws?.missing || `Workstream is ${statusLabel} but no specific blocker has been articulated by the owner.`,
          data_blind_spot: ws?.data_blind_spot ?? null,
          auto_injected: true,
          auto_injected_reason: `non_green_workstream_${rag}`,
        });
        watchlistAutoInjected++;
      }

      // (b) Silent priorities → ensure a row exists (one per silent priority).
      // Derive locally from `missing` + `signalsByPriority` (silentMissing is
      // computed later in section 6; we replicate it here to stay in scope).
      const silentMissingLocal = (Array.isArray(missing) ? missing : []).filter((mm: any) => {
        const sig = signalsByPriority?.get?.(mm.priority_id);
        return !sig || (Array.isArray(sig.mentions) && sig.mentions.length === 0);
      });
      for (const sm of silentMissingLocal) {
        const priorityName = sm.priority || "";
        if (!priorityName || hasRowFor(priorityName)) continue;
        wlIn.push({
          workstream: priorityName,
          owner: expectedOwnerFor(sm.priority_id, sm.expected_owner),
          status: "Silent",
          good_looks_like: successCriteriaFor(priorityName),
          missing: "No owned workstream — no cards, no Azure items, no releases attributed in the last 7 days.",
          data_blind_spot: null,
          auto_injected: true,
          auto_injected_reason: "silent_priority",
        });
        watchlistAutoInjected++;
      }

      // (c) Uncovered coverage domains — priorities with coverage_pct < 50 not yet covered.
      try {
        const sc: any[] = Array.isArray((data_coverage_audit as any)?.strategic_coverage)
          ? (data_coverage_audit as any).strategic_coverage
          : [];
        for (const pc of sc) {
          const pct = Number(pc?.coverage_pct ?? 100);
          if (!Number.isFinite(pct) || pct >= 50) continue;
          const title = String(pc?.priority_title || "").trim();
          if (!title || hasRowFor(title)) continue;
          // Find the worst (most missing) domain to name as blind spot.
          const byDomain: any[] = Array.isArray(pc?.by_domain) ? pc.by_domain : [];
          const worstDomain = byDomain
            .map((d: any) => ({
              label: d?.domain_label || d?.domain || "",
              missingCount: Array.isArray(d?.missing) ? d.missing.length : 0,
            }))
            .sort((a, b) => b.missingCount - a.missingCount)[0];
          const blindSpotLabel = worstDomain?.label || null;
          wlIn.push({
            workstream: title,
            owner: expectedOwnerFor(pc?.priority_id),
            status: "Uncovered",
            good_looks_like: successCriteriaFor(title),
            missing: blindSpotLabel
              ? `Coverage ${pct}% — top blind spot: ${blindSpotLabel} (${worstDomain.missingCount} required artifact${worstDomain.missingCount === 1 ? "" : "s"} missing).`
              : `Coverage ${pct}% — required artifacts missing across knowledge domains.`,
            data_blind_spot: blindSpotLabel,
            auto_injected: true,
            auto_injected_reason: "uncovered_priority",
          });
          watchlistAutoInjected++;
        }
      } catch (_) { /* non-fatal */ }

      // (d) Silent leaders owning 2026 priorities → one row per owned priority.
      try {
        const lsm: any[] = Array.isArray(leader_signal_map) ? leader_signal_map : [];
        for (const ls of lsm) {
          if (norm(ls?.signal_status) !== "silent") continue;
          const owns: string[] = Array.isArray(ls?.owns_priorities) ? ls.owns_priorities : [];
          if (owns.length === 0) continue;
          for (const priorityTitle of owns) {
            const title = String(priorityTitle || "").trim();
            if (!title || hasRowFor(title)) continue;
            wlIn.push({
              workstream: title,
              owner: ls?.name || "Unassigned",
              status: "Silent",
              good_looks_like: successCriteriaFor(title),
              missing: `${ls?.name || "Owner"} silent 7d — no meetings, workstream cards, Azure items or releases attributed.`,
              data_blind_spot: null,
              auto_injected: true,
              auto_injected_reason: "silent_leader_owns_priority",
            });
            watchlistAutoInjected++;
          }
        }
      } catch (_) { /* non-fatal */ }

      // Final fallback: empty watchlist on a non-green briefing is itself a finding.
      const _outcomeProb = typeof parsed.outcome_probability === "number" ? parsed.outcome_probability : 50;
      const _coverageGapsLen = Array.isArray(parsed.payload?.coverage_gaps) ? parsed.payload.coverage_gaps.length : 0;
      if (wlIn.length === 0 && (_outcomeProb < 70 || _coverageGapsLen > 0)) {
        wlIn.push({
          workstream: "Watchlist detection found nothing",
          owner: "Duncan",
          status: "Red",
          good_looks_like: "At least one accountable workstream-owner-blocker triple per non-green priority surfaced here.",
          missing: "Verify Duncan has visibility into workstreams + 2026 priorities — an empty watchlist on a non-green briefing is unusual.",
          data_blind_spot: null,
          auto_injected: true,
          auto_injected_reason: "empty_watchlist_non_green_briefing",
        });
        watchlistAutoInjected++;
      }

      // Normalise rows + write back BEFORE the 40% concentration cap runs on the combined list.
      parsed.payload.watchlist = wlIn.map((r: any) => ({
        workstream: String(r?.workstream || "").trim() || "Unspecified workstream",
        owner: String(r?.owner || "").trim() || "Unassigned",
        status: String(r?.status || "").trim() || "At Risk",
        good_looks_like: String(r?.good_looks_like || "").trim() || "—",
        missing: String(r?.missing || "").trim() || "—",
        data_blind_spot: r?.data_blind_spot ?? null,
        auto_injected: !!r?.auto_injected,
        ...(r?.auto_injected_reason ? { auto_injected_reason: r.auto_injected_reason } : {}),
      }));
      parsed.payload.watchlist_meta = {
        total: parsed.payload.watchlist.length,
        auto_injected: watchlistAutoInjected,
      };
    }

    // 4d. Watchlist owner-concentration cap (40% rule) + display name resolution.
    if (briefing_type === "morning" && Array.isArray(parsed.payload?.watchlist) && parsed.payload.watchlist.length > 0) {
      const teamNames = new Set(
        ((profiles as any[]) || [])
          .map((p: any) => (p.display_name || "").toLowerCase())
          .filter(Boolean)
      );
      const wl = parsed.payload.watchlist as any[];
      const total = wl.length;
      // Count first-name occurrences (covers "Simon", "Simon (Ops Director)", etc.)
      const firstNameOf = (owner: string) => String(owner || "").trim().split(/\s+/)[0].toLowerCase();
      const counts = new Map<string, number>();
      for (const row of wl) {
        const fn = firstNameOf(row.owner);
        if (fn) counts.set(fn, (counts.get(fn) || 0) + 1);
      }
      const cap = Math.max(1, Math.floor(total * 0.4));
      for (const [name, n] of counts.entries()) {
        if (n <= cap) continue;
        let surplus = n - cap;
        for (const row of wl) {
          if (surplus <= 0) break;
          if (firstNameOf(row.owner) !== name) continue;
          // Skip the first `cap` rows for this owner — only rebalance the surplus.
          if ((counts.get(`__kept_${name}`) || 0) < cap) {
            counts.set(`__kept_${name}`, (counts.get(`__kept_${name}`) || 0) + 1);
            continue;
          }
          row.original_owner = row.owner;
          row.owner = "Cross-functional — escalate to CEO";
          row.reassignment_reason = `Single-owner concentration (>40%) on "${name}" — reassigned for accountability balance.`;
          surplus--;
        }
      }
    }

    // 4d-bis. Leadership roster enforcement — every direct report must appear,
    //         silent leaders auto-flagged for CEO intervention.
    if (briefing_type === "morning") {
      const aiLeaders: any[] = Array.isArray(parsed.payload?.leadership) ? parsed.payload.leadership : [];
      const norm = (s: string) => String(s || "").toLowerCase().trim();
      const findAi = (rosterName: string) =>
        aiLeaders.find((l) => norm(l?.name).includes(norm(rosterName)) || norm(rosterName).includes(norm(l?.name)));

      const fullRoster = LEADERSHIP_ROSTER.map((leader) => {
        const sig = leader_signal_map.find((s) => s.name === leader.name)!;
        const ai = findAi(leader.name);
        const status = sig.signal_status;
        const isOwnerOfPriority = (leader.owns_priorities ?? []).length > 0;

        if (ai && status !== "silent") {
          // Trust the AI but stamp deterministic signal fields.
          return {
            name: leader.name,
            role: ai.role || leader.role,
            output_vs_expectation: ai.output_vs_expectation || `Active in ${sig.sources.join(", ")}.`,
            risk_level: ai.risk_level || (status === "low_signal" ? "medium" : "low"),
            blocking: ai.blocking || "",
            needs_support: ai.needs_support || "",
            ceo_intervention_required: !!ai.ceo_intervention_required,
            signal_status: status,
            evidence_sources: sig.sources,
          };
        }

        // Silent OR omitted — synthesize the stub.
        return {
          name: leader.name,
          role: leader.role,
          output_vs_expectation:
            status === "silent"
              ? "No operational signal in 7 days — no meetings, workstream cards, Azure items or releases attributed to this leader."
              : (ai?.output_vs_expectation || `Single-source signal only (${sig.sources.join(", ") || "none"}).`),
          risk_level:
            status === "silent"
              ? (isOwnerOfPriority ? "high" : "medium")
              : (ai?.risk_level || "medium"),
          blocking: status === "silent" ? "Invisible to Duncan — unknown." : (ai?.blocking || ""),
          needs_support:
            status === "silent"
              ? "CEO check-in to surface what they are actually working on, blocked by, or capacity-constrained on."
              : (ai?.needs_support || ""),
          ceo_intervention_required: status === "silent" ? true : !!ai?.ceo_intervention_required,
          signal_status: status,
          evidence_sources: sig.sources,
        };
      });

      // Sort: intervention → high risk → silent → low_signal → active
      const riskRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const sigRank: Record<string, number> = { silent: 0, low_signal: 1, active: 2 };
      fullRoster.sort((a, b) => {
        if (a.ceo_intervention_required !== b.ceo_intervention_required) return a.ceo_intervention_required ? -1 : 1;
        const r = (riskRank[a.risk_level] ?? 9) - (riskRank[b.risk_level] ?? 9);
        if (r !== 0) return r;
        return (sigRank[a.signal_status] ?? 9) - (sigRank[b.signal_status] ?? 9);
      });

      parsed.payload.leadership = fullRoster;
      parsed.payload.leadership_summary = {
        total: fullRoster.length,
        active: fullRoster.filter((l) => l.signal_status === "active").length,
        low_signal: fullRoster.filter((l) => l.signal_status === "low_signal").length,
        silent: fullRoster.filter((l) => l.signal_status === "silent").length,
        intervention_required: fullRoster.filter((l) => l.ceo_intervention_required).length,
      };
    }

    // 4e. Missing artifacts recommendations — clean, cap at 15, link to decisions §9.
    if (briefing_type === "morning") {
      const validDomainIds = new Set(KNOWLEDGE_DOMAINS.map((d) => d.id));
      const validPrio = new Set(["critical", "high", "medium", "low"]);
      const rawRec = Array.isArray(parsed.payload?.missing_artifacts_recommendations)
        ? parsed.payload.missing_artifacts_recommendations : [];
      const cleanedRec = rawRec
        .filter((r: any) => r && validDomainIds.has(r.domain) && validPrio.has((r.priority || "").toLowerCase()))
        .map((r: any) => ({
          domain: r.domain,
          priority: String(r.priority).toLowerCase(),
          artifacts: Array.isArray(r.artifacts) ? r.artifacts.filter((a: any) => a && typeof a.name === "string").slice(0, 6) : [],
        }))
        .filter((r: any) => r.artifacts.length > 0);

      // Cap at 15 artifacts total, ranked by priority.
      const prioRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const flat: Array<{ domain: string; priority: string; artifact: any }> = [];
      for (const r of cleanedRec) for (const a of r.artifacts) flat.push({ domain: r.domain, priority: r.priority, artifact: a });
      flat.sort((a, b) => (prioRank[a.priority] ?? 9) - (prioRank[b.priority] ?? 9));
      const capped = flat.slice(0, 15);
      const regrouped = new Map<string, { domain: string; priority: string; artifacts: any[] }>();
      for (const f of capped) {
        const key = `${f.domain}::${f.priority}`;
        if (!regrouped.has(key)) regrouped.set(key, { domain: f.domain, priority: f.priority, artifacts: [] });
        regrouped.get(key)!.artifacts.push(f.artifact);
      }
      parsed.payload.missing_artifacts_recommendations = Array.from(regrouped.values());

      // Counter for the UI.
      const counter = { total: capped.length, critical: 0, high: 0, medium: 0, low: 0 };
      for (const f of capped) (counter as any)[f.priority]++;
      parsed.payload.missing_artifacts_summary = counter;

      // Decisions §9 — enrich blocked_by_missing_data with specific artifact names.
      if (Array.isArray(parsed.payload.decisions) && capped.length > 0) {
        const domainLabelById = new Map(KNOWLEDGE_DOMAINS.map((d) => [d.id, d.label]));
        const criticalByDomain = new Map<string, string[]>();
        for (const f of capped) {
          if (f.priority !== "critical" && f.priority !== "high") continue;
          const arr = criticalByDomain.get(f.domain) || [];
          if (arr.length < 3) arr.push(f.artifact.name);
          criticalByDomain.set(f.domain, arr);
        }
        for (const dec of parsed.payload.decisions) {
          if (!dec?.blocked_by_missing_data || typeof dec.blocked_by_missing_data !== "string") continue;
          const txt = dec.blocked_by_missing_data.toLowerCase();
          // Already includes "needs:" prefix — leave alone.
          if (txt.startsWith("needs:")) continue;
          // Find which domain this decision references.
          for (const [domId, label] of domainLabelById.entries()) {
            if (!txt.includes(label.toLowerCase())) continue;
            const artNames = criticalByDomain.get(domId);
            if (!artNames || artNames.length === 0) break;
            const blockedArtifacts = artNames.map((n) => n).join(", ");
            dec.blocked_artifact_names = artNames;
            dec.blocked_by_missing_data = `Needs: ${blockedArtifacts} — ${dec.blocked_by_missing_data}`;
            break;
          }
        }
      }
    }

    const trueCovered = covered.length;
    const proseFields = ["company_pulse", "brutal_truth", "execution_explanation", "probability_movement"] as const;
    for (const field of proseFields) {
      const val = parsed.payload?.[field];
      if (typeof val !== "string" || !val) continue;
      const re = /\b(\d{1,2})\s*(?:of|out of|\/)\s*6\b/gi;
      let mismatch = false;
      let m: RegExpExecArray | null;
      while ((m = re.exec(val)) !== null) {
        const claimed = parseInt(m[1], 10);
        if (!Number.isNaN(claimed) && claimed !== trueCovered) { mismatch = true; break; }
      }
      if (mismatch) {
        parsed.payload[field] = `${val.trim()} (Server correction: only ${trueCovered} of ${totalPriorities} 2026 priorities have an active workstream.)`;
      }
    }

    // 6. Server-authoritative Company Pulse (RYG) — deterministic, not AI-decided.
    //    Inputs: coverage, implicit signals, execution evidence, blockers, prior trend.
    if (briefing_type === "morning") {
      const lightningCovered = covered.find(c =>
        (c.priority || "").toLowerCase().includes("lightning strike")
        || (c.matched_workstream || "").toLowerCase().includes("lightning strike")
      );
      const silentMissing = missing.filter(m => {
        const sig = signalsByPriority.get(m.priority_id);
        return !sig || sig.mentions.length === 0;
      });
      const untrackedActive = missing.filter(m => {
        const sig = signalsByPriority.get(m.priority_id);
        return !!(sig && sig.mentions.length > 0);
      });

      const recentCardActivity = (cards as any[]).length;
      const recentAzureActivity = (workItems as any[]).length;
      const failedSyncs = (syncLogs as any[]).filter((s: any) => (s.status || "").toLowerCase() === "failed").length;
      const criticalIssues = (issues as any[]).filter((i: any) => ["critical", "high"].includes((i.severity || "").toLowerCase())).length;
      const overdueFinance = (xeroContacts as any[]).length;
      const prevRow = (prev as any[])[0] ?? null;

      const evidence: string[] = [];
      const blockers: string[] = [];
      const positives: string[] = [];

      evidence.push(`${covered.length} of ${totalPriorities} 2026 priorities have a tracked workstream (${Math.round(coverageRatio * 100)}%).`);
      if (untrackedActive.length > 0) evidence.push(`${untrackedActive.length} priorit${untrackedActive.length === 1 ? "y is" : "ies are"} discussed in recent meetings but have no formal workstream.`);
      if (silentMissing.length > 0) evidence.push(`${silentMissing.length} priorit${silentMissing.length === 1 ? "y has" : "ies have"} no visible activity anywhere (silent).`);
      evidence.push(`Recent execution: ${recentCardActivity} workstream card update${recentCardActivity === 1 ? "" : "s"}, ${recentAzureActivity} Azure work item change${recentAzureActivity === 1 ? "" : "s"} in last 24h.`);

      // Data coverage blind spots
      const dca = data_coverage_audit;
      if (dca.counts.red > 0 || dca.counts.yellow > 0) {
        evidence.push(`Data blind spots: ${dca.counts.red} red, ${dca.counts.yellow} yellow across ${dca.counts.total} knowledge domains (confidence cap: ${dca.confidence_cap}).`);
      }
      if (dca.critical_reds.length > 0) {
        blockers.push(`Critical knowledge gaps: ${dca.critical_reds.map((d) => d.label).join(", ")} — Duncan has no data here and cannot judge these areas honestly.`);
      }

      if (!lightningCovered) blockers.push("Lightning Strike Event has no tracked workstream — the flagship June 7 commitment is invisible to execution tracking.");
      if (silentMissing.length >= 2) blockers.push(`${silentMissing.length} priorities are completely silent — no meetings, no workstreams, no owners.`);
      if (failedSyncs > 0) blockers.push(`${failedSyncs} integration sync failure${failedSyncs === 1 ? "" : "s"} in last 24h — data freshness at risk.`);
      if (criticalIssues > 0) blockers.push(`${criticalIssues} critical/high-severity issue${criticalIssues === 1 ? "" : "s"} logged in last 24h.`);
      if (overdueFinance > 0) blockers.push(`${overdueFinance} customer${overdueFinance === 1 ? "" : "s"} with overdue balances.`);

      if (lightningCovered) positives.push(`Lightning Strike Event is tracked via "${lightningCovered.matched_workstream}".`);
      if (recentCardActivity + recentAzureActivity > 10) positives.push("Healthy execution velocity in last 24h.");
      if (untrackedActive.length > 0) positives.push("Some untracked work IS happening — formalising it into workstreams will close visibility gaps fast.");

      // Status decision
      let status: "red" | "yellow" | "green" = "yellow";
      let reason = "";

      const fullCoverage = coverageRatio >= 1.0;
      const halfOrLess = coverageRatio < 0.5;
      const majorBlockerCount = blockers.length;

      if (fullCoverage && majorBlockerCount === 0 && (recentCardActivity + recentAzureActivity) > 0) {
        status = "green";
        reason = `All ${totalPriorities} non-negotiable 2026 priorities have tracked workstreams, execution evidence is current, and no major blockers materially threaten June 7 readiness.`;
      } else if (halfOrLess || !lightningCovered || silentMissing.length >= 2 || majorBlockerCount >= 2) {
        status = "red";
        const parts: string[] = [];
        parts.push(`Only ${covered.length} of ${totalPriorities} non-negotiable 2026 priorities have a tracked workstream.`);
        if (untrackedActive.length > 0) parts.push(`${untrackedActive.length} more ${untrackedActive.length === 1 ? "is" : "are"} being discussed in meetings but remain untracked.`);
        if (silentMissing.length > 0) parts.push(`${silentMissing.length} have no visible activity at all.`);
        if (!lightningCovered) parts.push("Lightning Strike Event itself is not tracked.");
        parts.push("This means leadership has weak execution visibility and cannot honestly claim June 7 readiness.");
        reason = parts.join(" ");
      } else {
        status = "yellow";
        reason = `Coverage is partial (${covered.length}/${totalPriorities}). Meaningful momentum exists but ownership and tracking are incomplete — ${untrackedActive.length} priorit${untrackedActive.length === 1 ? "y is" : "ies are"} being worked on without a formal workstream, and ${blockers.length} blocker${blockers.length === 1 ? "" : "s"} need attention before status can move to Green.`;
      }

      // Trend hint (informational only)
      if (prevRow && typeof prevRow.outcome_probability === "number" && typeof parsed.outcome_probability === "number") {
        const delta = parsed.outcome_probability - prevRow.outcome_probability;
        if (delta <= -5) evidence.push(`Probability down ${Math.abs(delta)} pts vs previous briefing.`);
        else if (delta >= 5) positives.push(`Probability up ${delta} pts vs previous briefing.`);
      }

      const confidence: "high" | "medium" | "low" = coverageRatio >= 0.8 ? "high" : coverageRatio >= 0.4 ? "medium" : "low";
      const label = status === "red" ? "Red" : status === "yellow" ? "Yellow" : "Green";

      const company_pulse_status = {
        status, label, reason,
        evidence, blockers, positive_signals: positives, confidence,
      };

      parsed.payload.company_pulse_status = company_pulse_status;

      // Force company_pulse prose to begin with the server status + reason.
      const aiPulse = typeof parsed.payload.company_pulse === "string" ? parsed.payload.company_pulse.trim() : "";
      const startsWithStatus = aiPulse.toUpperCase().startsWith(label.toUpperCase());
      if (!aiPulse || !startsWithStatus) {
        parsed.payload.company_pulse = `${label.toUpperCase()} — ${reason}`;
      }

      // Force brutal_truth + tldr.where_to_act to mention worst critical-red domain.
      const worst = data_coverage_audit.worst_red_domain;
      if (worst && data_coverage_audit.critical_reds.length > 0) {
        const bt = typeof parsed.payload.brutal_truth === "string" ? parsed.payload.brutal_truth.trim() : "";
        const mentionsDomain = bt.toLowerCase().includes(worst.label.toLowerCase());
        if (!bt || !mentionsDomain) {
          parsed.payload.brutal_truth = `${bt ? bt + " " : ""}Duncan is flying blind on ${worst.label} — no data exists for it, so any confidence projected here is theatre, not analysis.`;
        }
        parsed.payload.tldr = parsed.payload.tldr || {};
        const wta = typeof parsed.payload.tldr.where_to_act === "string" ? parsed.payload.tldr.where_to_act.trim() : "";
        const mentionsUpload = wta.toLowerCase().includes(worst.label.toLowerCase());
        if (!wta || !mentionsUpload) {
          parsed.payload.tldr.where_to_act = `${wta ? wta + " " : ""}${worst.recommendation || `Upload ${worst.label} documents to /projects to remove this blind spot.`}`;
        }
      }

      // 7. Risk Radar reconciliation — risks must explain the headline.
      const outcomeProb = typeof parsed.outcome_probability === "number" ? parsed.outcome_probability : 50;
      const execScore = typeof parsed.execution_score === "number" ? parsed.execution_score : 60;
      const probabilityGap = Math.max(0, 100 - outcomeProb);
      const headlineIsRed = outcomeProb < 50 || execScore < 60;

      let risks: any[] = Array.isArray(parsed.payload.risks) ? [...parsed.payload.risks] : [];
      let autoInjectedCount = 0;

      // 7a. Inject synthetic risk for every silent priority not already named in risks.
      for (const sm of silentMissing) {
        const priorityName = sm.priority || "";
        const firstWord = priorityName.toLowerCase().split(/[\s—-]+/)[0] || "";
        const alreadyNamed = risks.some((r: any) =>
          typeof r?.risk === "string" && firstWord && r.risk.toLowerCase().includes(firstWord)
        );
        if (alreadyNamed) continue;
        risks.push({
          risk: `${priorityName} is silent — no meetings, no workstreams, no owner activity in the last 7 days`,
          why_it_matters: "A 2026 non-negotiable priority with zero signal cannot be tracked, evaluated, or de-risked. Invisible work = unmanaged work.",
          impact_7d: { window: "7d", impact: "Status unknown — Duncan cannot judge readiness.", mitigation: "CEO assigns a named owner this week." },
          impact_30d: { window: "30d", impact: "Slip risk compounds — dependent priorities start to drift.", mitigation: "Stand up a formal workstream with weekly check-ins." },
          impact_90d: { window: "90d", impact: "June 7 readiness materially impaired if still unowned.", mitigation: "Escalate to board if no owner accepts." },
          owner: "Unassigned — CEO to allocate",
          severity: "high",
          confidence: 90,
          probability_impact_pts: 15,
          auto_injected: true,
          auto_injected_reason: "silent_priority",
        });
        autoInjectedCount++;
      }

      // 7b. If headline is red but no critical/high risk exists, upgrade top + add system note.
      if (headlineIsRed) {
        const hasHighSev = risks.some((r: any) => {
          const s = String(r?.severity || "").toLowerCase();
          return s === "critical" || s === "high";
        });
        if (!hasHighSev && risks.length > 0) {
          // Upgrade the risk with the largest probability_impact_pts (or first one).
          let topIdx = 0;
          let topPts = -1;
          risks.forEach((r: any, i: number) => {
            const pts = typeof r?.probability_impact_pts === "number" ? r.probability_impact_pts : 0;
            if (pts > topPts) { topPts = pts; topIdx = i; }
          });
          risks[topIdx] = { ...risks[topIdx], severity: "high", auto_upgraded: true };
        }
        if (!hasHighSev) {
          risks.push({
            risk: `Outcome probability is ${outcomeProb}% and execution is ${execScore}/100 — the listed risks under-explain the gap`,
            why_it_matters: "When the headline says red but the radar shows nothing critical, Duncan is missing risks. Verify with owners before any board sign-off.",
            impact_7d: { window: "7d", impact: "Decisions based on this briefing may be premature.", mitigation: "Walk through risks live with each direct report." },
            impact_30d: { window: "30d", impact: "Risk model drifts further from reality.", mitigation: "Force a structured risk review per workstream." },
            impact_90d: { window: "90d", impact: "Material surprise risk by June 7.", mitigation: "Independent review of the risk register." },
            owner: "CEO",
            severity: "high",
            confidence: 80,
            probability_impact_pts: Math.max(10, probabilityGap - risks.reduce((s: number, r: any) => s + (Number(r?.probability_impact_pts) || 0), 0)),
            auto_injected: true,
            auto_injected_reason: "headline_under_explained",
          });
          autoInjectedCount++;
        }
      }

      // 7c. Normalize probability_impact_pts. Ensure each is a positive int and sum is within ±10 of gap.
      // First, default missing values: estimate from severity.
      const sevToPts: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3 };
      for (const r of risks) {
        const pts = Number(r?.probability_impact_pts);
        if (!Number.isFinite(pts) || pts <= 0) {
          const sev = String(r?.severity || "medium").toLowerCase();
          r.probability_impact_pts = sevToPts[sev] ?? 8;
        } else {
          r.probability_impact_pts = Math.max(1, Math.round(pts));
        }
      }

      const rawSum = risks.reduce((s: number, r: any) => s + (r.probability_impact_pts || 0), 0);
      // Scale toward the gap if we're significantly off and have risks to scale.
      if (probabilityGap > 0 && rawSum > 0 && Math.abs(rawSum - probabilityGap) > 10 && risks.length > 0) {
        const scale = probabilityGap / rawSum;
        // Only scale DOWN if over-attributed; if under-attributed, leave to surface unexplained_pts.
        if (rawSum > probabilityGap) {
          for (const r of risks) {
            r.probability_impact_pts = Math.max(1, Math.round((r.probability_impact_pts || 0) * scale));
          }
        }
      }

      // 7d. Sort by probability_impact_pts DESC.
      risks.sort((a: any, b: any) => (b.probability_impact_pts || 0) - (a.probability_impact_pts || 0));

      const accountedForPts = risks.reduce((s: number, r: any) => s + (r.probability_impact_pts || 0), 0);
      const unexplainedPts = Math.max(0, probabilityGap - accountedForPts);

      parsed.payload.risks = risks;
      parsed.payload.risk_reconciliation = {
        outcome_probability: outcomeProb,
        execution_score: execScore,
        probability_gap: probabilityGap,
        accounted_for_pts: accountedForPts,
        unexplained_pts: unexplainedPts,
        auto_injected_count: autoInjectedCount,
        warning: unexplainedPts > 10
          ? `${unexplainedPts} pts of probability loss not explained by listed risks — Duncan may be missing a risk.`
          : null,
      };
    }

    // ─── 8. Cross-Functional Friction post-processor (deterministic floor) ──
    if (briefing_type === "morning") {
      parsed.payload = parsed.payload || {};
      let friction: any[] = Array.isArray(parsed.payload.friction) ? [...parsed.payload.friction] : [];
      let frictionAutoInjected = 0;

      // Recompute silentMissing in this scope (defined earlier in section 6 block, out of scope here).
      const silentMissing = (Array.isArray(missing) ? missing : []).filter((mm: any) => {
        const sig = signalsByPriority?.get?.(mm.priority_id);
        return !sig || (Array.isArray(sig.mentions) && sig.mentions.length === 0);
      });

      const frictionMentions = (needle: string): boolean => {
        if (!needle) return false;
        const n = needle.toLowerCase();
        return friction.some((f: any) => {
          const blob = `${f?.issue || ""} ${f?.consequence || ""} ${(Array.isArray(f?.teams) ? f.teams.join(" ") : f?.teams) || ""}`.toLowerCase();
          return blob.includes(n);
        });
      };

      // 8a. Inject friction for every silent priority not already covered.
      for (const sm of silentMissing) {
        const priorityName = sm.priority || "";
        const firstWord = priorityName.toLowerCase().split(/[\s—-]+/)[0] || "";
        if (firstWord && frictionMentions(firstWord)) continue;
        const ownerName = sm.expected_owner || "Unassigned";
        friction.push({
          issue: `${priorityName} has no visible activity, yet remains a 2026 non-negotiable — handoff between strategy and execution is broken`,
          teams: [ownerName, "Cross-functional"],
          consequence: `${priorityName} target at risk; no team is structurally accountable.`,
          evidence_source: "silent_leader",
          recommended_resolver: "CEO",
          auto_injected: true,
          auto_injected_reason: "silent_priority",
        });
        frictionAutoInjected++;
      }

      // 8b. Inject friction for cross-function email escalations not already covered.
      try {
        const escalations = email_pulse?.signals?.escalations;
        if (Array.isArray(escalations)) {
          for (const esc of escalations) {
            const fromFn = String(esc?.from_function || esc?.from || "").trim();
            const toFn = String(esc?.to_function || esc?.to || "").trim();
            const topic = String(esc?.topic || "").trim();
            if (!fromFn || !toFn || fromFn.toLowerCase() === toFn.toLowerCase()) continue;
            if (topic && frictionMentions(topic)) continue;
            friction.push({
              issue: `Email escalation crossing functions: ${fromFn} → ${toFn}${topic ? ` re "${topic}"` : ""} — no shared owner has resolved it`,
              teams: [fromFn, toFn],
              consequence: topic ? `Unresolved cross-team item: ${topic}` : "Cross-functional escalation pending resolution.",
              evidence_source: "email",
              recommended_resolver: "CEO",
              auto_injected: true,
              auto_injected_reason: "cross_function_email_escalation",
            });
            frictionAutoInjected++;
          }
        }
      } catch (_) { /* non-fatal */ }

      // 8c. Red briefing fallback — empty friction on a red briefing is itself a finding.
      const _outcomeProb = typeof parsed.outcome_probability === "number" ? parsed.outcome_probability : 50;
      if (_outcomeProb < 50 && friction.length === 0) {
        friction.push({
          issue: "Friction detection ran but found no cross-functional blockers — this is unusual on a Red briefing",
          teams: ["Duncan", "Leadership"],
          consequence: "Verify Duncan has visibility into cross-team blockers (workstream notes, meeting transcripts, email pulse opt-ins) before trusting harmony as real.",
          evidence_source: "coverage_gap",
          recommended_resolver: "CEO",
          auto_injected: true,
          auto_injected_reason: "red_briefing_empty_friction",
        });
        frictionAutoInjected++;
      }

      // Normalise: ensure required fields on every entry.
      friction = friction.map((f: any) => ({
        issue: String(f?.issue || "").trim() || "Unspecified friction",
        teams: Array.isArray(f?.teams) ? f.teams.filter(Boolean).map((t: any) => String(t)) : (f?.teams ? [String(f.teams)] : []),
        consequence: String(f?.consequence || "").trim(),
        evidence_source: ["workstream_card", "meeting", "email", "coverage_gap", "silent_leader", "doc_conflict"].includes(String(f?.evidence_source))
          ? f.evidence_source
          : "workstream_card",
        recommended_resolver: String(f?.recommended_resolver || "CEO").trim() || "CEO",
        auto_injected: !!f?.auto_injected,
        ...(f?.auto_injected_reason ? { auto_injected_reason: f.auto_injected_reason } : {}),
      }));

      parsed.payload.friction = friction;
      parsed.payload.friction_meta = {
        total: friction.length,
        auto_injected: frictionAutoInjected,
      };
    }

    // 4f. DETERMINISTIC DECISIONS FLOOR — guarantees Section 9 is never empty on a non-green briefing.
    if (briefing_type === "morning") {
      parsed.payload = parsed.payload || {};
      const aiDecisions: any[] = Array.isArray(parsed.payload.decisions) ? [...parsed.payload.decisions] : [];
      let decisionsAutoInjected = 0;

      const dnorm = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const decisionKey = (d: any) => dnorm(d?.decision).slice(0, 80);
      const seen = new Set<string>(aiDecisions.map(decisionKey).filter(Boolean));
      const hasDecision = (text: string) => {
        const k = dnorm(text).slice(0, 80);
        if (!k) return false;
        if (seen.has(k)) return true;
        for (const ek of seen) {
          if (!ek) continue;
          if (ek.includes(k) || k.includes(ek)) return true;
        }
        return false;
      };
      const pushDecision = (d: any, urgency: number) => {
        const key = decisionKey(d);
        if (!key || seen.has(key)) return;
        seen.add(key);
        aiDecisions.push({ ...d, _urgency: urgency });
        decisionsAutoInjected++;
      };

      const cap = (parsed.payload?.data_coverage_audit as any)?.confidence_cap || "medium";
      const capConfidence = (c: string) => {
        const order = { high: 3, medium: 2, low: 1 } as const;
        const want = (order as any)[c] ?? 2;
        const max = (order as any)[cap] ?? 2;
        return want <= max ? c : cap;
      };

      // (a) Coverage gaps + (b) silent priorities → assign owner.
      const coverageGaps: any[] = Array.isArray(parsed.payload.coverage_gaps) ? parsed.payload.coverage_gaps : [];
      const silentMissingDec = (Array.isArray(missing) ? missing : []).filter((mm: any) => {
        const sig = signalsByPriority?.get?.(mm.priority_id);
        return !sig || (Array.isArray(sig.mentions) && sig.mentions.length === 0);
      });
      const allUncovered = [
        ...coverageGaps.map((g: any) => ({ priority: g?.priority || g?.priority_title || g?.title, priority_id: g?.priority_id, expected_owner: g?.expected_owner })),
        ...silentMissingDec.map((sm: any) => ({ priority: sm?.priority, priority_id: sm?.priority_id, expected_owner: sm?.expected_owner })),
      ].filter((x) => x.priority);
      const seenPriority = new Set<string>();
      for (const u of allUncovered) {
        const pk = dnorm(u.priority);
        if (!pk || seenPriority.has(pk)) continue;
        seenPriority.add(pk);
        const def = PRIORITY_DEFINITIONS.find((p) => p.id === u.priority_id);
        const owner = def?.expected_owner || u.expected_owner || "Cross-functional — escalate to CEO";
        const decisionText = `Assign accountable owner and stand up workstream for ${u.priority}`;
        if (hasDecision(decisionText)) continue;
        pushDecision({
          decision: decisionText,
          why_it_matters: `${u.priority} is a 2026 priority with no owned workstream — the company cannot deliver against a plan no-one is running.`,
          consequence: `Another 7 days of zero attributable activity — risk of missing the priority outright.`,
          who_to_involve: owner,
          confidence: capConfidence("high"),
          blocked_by_missing_data: null,
          evidence_source: "silent_priority",
          auto_injected: true,
        }, 100);
      }

      // (c) High/critical risks → mitigation call.
      const risksArr: any[] = Array.isArray(parsed.payload.risks) ? parsed.payload.risks : [];
      for (const r of risksArr) {
        const sev = String(r?.severity || "").toLowerCase();
        if (sev !== "high" && sev !== "critical") continue;
        const title = String(r?.risk || r?.title || r?.name || "").trim();
        if (!title) continue;
        const impact = Number(r?.probability_impact_pts || 0);
        const decisionText = `Decide mitigation path for "${title}" or accept the ${impact}-pt probability hit`;
        if (hasDecision(decisionText)) continue;
        pushDecision({
          decision: decisionText,
          why_it_matters: `${sev.toUpperCase()} risk accounting for ${impact} pts of the outcome-probability gap.`,
          consequence: `If unaddressed for 7 days, baseline outcome probability stays anchored at the lower bound.`,
          who_to_involve: r?.owner || "CEO + accountable function lead",
          confidence: capConfidence(sev === "critical" ? "high" : "medium"),
          blocked_by_missing_data: null,
          evidence_source: "risk",
          auto_injected: true,
        }, 80 + Math.min(impact, 20));
      }

      // (d) CEO-resolved friction.
      const frictionArr: any[] = Array.isArray(parsed.payload.friction) ? parsed.payload.friction : [];
      for (const f of frictionArr) {
        const resolver = String(f?.recommended_resolver || "").toLowerCase();
        if (!resolver.includes("ceo")) continue;
        const teams = Array.isArray(f?.teams) ? f.teams.join("/") : "teams";
        const issue = String(f?.issue || "").trim();
        if (!issue) continue;
        const decisionText = `Break ${teams} deadlock on ${issue}`;
        if (hasDecision(decisionText)) continue;
        pushDecision({
          decision: decisionText,
          why_it_matters: f?.consequence || "Cross-functional friction with no single owner who can unblock it.",
          consequence: f?.consequence || "Friction compounds and the dependent priority slips.",
          who_to_involve: teams,
          confidence: capConfidence("medium"),
          blocked_by_missing_data: null,
          evidence_source: "friction",
          auto_injected: true,
        }, 70);
      }

      // (e) Critical email signals — board mentions, unowned commitments, escalations.
      try {
        const sigs = (email_pulse?.signals as any) || {};
        const board: any[] = Array.isArray(sigs.board_mentions) ? sigs.board_mentions : [];
        for (const b of board.slice(0, 2)) {
          const topic = String(b?.topic || b?.subject || b?.summary || "board mention").trim();
          const decisionText = `Decide CEO response to board signal: ${topic}`;
          if (hasDecision(decisionText)) continue;
          pushDecision({
            decision: decisionText,
            why_it_matters: "Board-level mention surfaced in leadership inbox in the last 24h.",
            consequence: "Silence reads as misalignment to the board.",
            who_to_involve: b?.from || "CEO + Chair",
            confidence: capConfidence("medium"),
            blocked_by_missing_data: null,
            evidence_source: "email",
            auto_injected: true,
          }, 75);
        }
        const unownedC: any[] = (Array.isArray(sigs.commitments) ? sigs.commitments : [])
          .filter((c: any) => !c?.owner || /unknown|tbd|n\/?a/i.test(String(c.owner)));
        for (const c of unownedC.slice(0, 2)) {
          const topic = String(c?.topic || c?.commitment || c?.summary || "ownerless commitment").trim();
          const decisionText = `Assign owner for ownerless commitment: ${topic}`;
          if (hasDecision(decisionText)) continue;
          pushDecision({
            decision: decisionText,
            why_it_matters: "Commitment made externally with no internal owner — accountability gap.",
            consequence: "Commitment slips silently with no-one tracking delivery.",
            who_to_involve: "CEO to allocate",
            confidence: capConfidence("medium"),
            blocked_by_missing_data: null,
            evidence_source: "email",
            auto_injected: true,
          }, 60);
        }
      } catch (_) { /* non-fatal */ }

      // (f) Silent leaders owning 2026 priorities — CEO intervention.
      try {
        const lsm: any[] = Array.isArray(leader_signal_map) ? leader_signal_map : [];
        for (const ls of lsm) {
          if (String(ls?.signal_status || "").toLowerCase() !== "silent") continue;
          const owns: string[] = Array.isArray(ls?.owns_priorities) ? ls.owns_priorities : [];
          if (owns.length === 0) continue;
          const decisionText = `Intervene with ${ls?.name || "silent leader"} — silent owner of ${owns.join(" + ")}`;
          if (hasDecision(decisionText)) continue;
          pushDecision({
            decision: decisionText,
            why_it_matters: `${ls?.name || "Leader"} owns ${owns.length} 2026 priority(ies) but produced no operational signal in 7 days.`,
            consequence: `Owned priorities continue with no visible ownership — unrecoverable if silence extends another week.`,
            who_to_involve: ls?.name || "Direct report",
            confidence: capConfidence("high"),
            blocked_by_missing_data: null,
            evidence_source: "silent_leader",
            auto_injected: true,
          }, 85);
        }
      } catch (_) { /* non-fatal */ }

      // (g) Confidence-cap blind spot — proceed-or-pause call.
      try {
        const dca: any = parsed.payload?.data_coverage_audit || {};
        const capLevel = String(dca?.confidence_cap || "high").toLowerCase();
        if (capLevel === "medium" || capLevel === "low") {
          const worst = dca?.worst_red_domain;
          const label = worst?.label || "critical knowledge domain";
          const decisionText = `Proceed with upcoming commitments OR pause until ${label} blind spot is closed`;
          if (!hasDecision(decisionText)) {
            pushDecision({
              decision: decisionText,
              why_it_matters: `Briefing confidence is capped at "${capLevel}" because ${label} evidence is missing — material decisions cannot be made honestly.`,
              consequence: `Decisions made under this cap carry undisclosed risk to board, customers, or launch.`,
              who_to_involve: "CEO + domain owner for " + label,
              confidence: capConfidence("high"),
              blocked_by_missing_data: `${label}: ${worst?.recommendation || "required artifacts not uploaded"}`,
              evidence_source: "data_blind_spot",
              auto_injected: true,
            }, 90);
          }
        }
      } catch (_) { /* non-fatal */ }

      // Final fallback — non-green briefing with zero decisions is itself a finding.
      const _outcomeProb = typeof parsed.outcome_probability === "number" ? parsed.outcome_probability : 50;
      const _trajectoryGreen = String(parsed.trajectory || "").toLowerCase().includes("on track");
      const _coverageGapsLen = Array.isArray(parsed.payload?.coverage_gaps) ? parsed.payload.coverage_gaps.length : 0;
      const isNonGreen = !_trajectoryGreen || _outcomeProb < 70 || _coverageGapsLen > 0;
      if (aiDecisions.length === 0 && isNonGreen) {
        pushDecision({
          decision: "Verify Duncan has visibility into priorities, risks and inboxes — no CEO-grade decisions detected on a non-green briefing",
          why_it_matters: "An empty Decisions section on a non-green briefing means Duncan cannot see the company clearly enough to surface a CEO call.",
          consequence: "CEO operates blind to the calls only they can make.",
          who_to_involve: "Duncan",
          confidence: "low",
          blocked_by_missing_data: "Decision detection produced no candidates from coverage gaps, risks, friction, email or leader signals.",
          evidence_source: null,
          auto_injected: true,
        }, 50);
      }

      // Sort by urgency DESC, keep top 3 for the UI, strip _urgency.
      aiDecisions.sort((a: any, b: any) => (b?._urgency ?? 0) - (a?._urgency ?? 0));
      const top = aiDecisions.slice(0, 3).map((d: any) => {
        const { _urgency, ...rest } = d;
        return {
          decision: String(rest?.decision || "").trim() || "Unspecified decision",
          why_it_matters: String(rest?.why_it_matters || "").trim() || "—",
          consequence: String(rest?.consequence || "").trim() || "—",
          who_to_involve: String(rest?.who_to_involve || "").trim() || "—",
          confidence: capConfidence(String(rest?.confidence || "medium").toLowerCase()),
          blocked_by_missing_data: rest?.blocked_by_missing_data ?? null,
          evidence_source: rest?.evidence_source ?? null,
          auto_injected: !!rest?.auto_injected,
        };
      });

      parsed.payload.decisions = top;
      parsed.payload.decisions_meta = {
        total_considered: aiDecisions.length,
        rendered: top.length,
        auto_injected: decisionsAutoInjected,
        confidence_cap: cap,
      };
    }

    if (email_pulse) {
      const sigs = email_pulse.signals || {};
      const commitments = Array.isArray(sigs.commitments) ? sigs.commitments : [];
      const risks = Array.isArray(sigs.risks) ? sigs.risks : [];
      const unowned = commitments.filter((c: any) => !c.owner || String(c.owner).trim() === "" || /unknown|tbd|n\/?a/i.test(String(c.owner))).length;
      const critical = risks.filter((r: any) => /critical|high/i.test(String(r.severity || ""))).length;

      parsed.payload = parsed.payload || {};
      parsed.payload.email_pulse = {
        window_hours: email_pulse.window_hours ?? 24,
        mailboxes_eligible: email_pulse.mailboxes_eligible ?? 0,
        mailboxes_total: email_pulse.mailboxes_total ?? 0,
        mailboxes_skipped_optout: email_pulse.mailboxes_skipped_optout ?? 0,
        emails_analysed: email_pulse.emails_analysed ?? 0,
        per_mailbox: email_pulse.per_mailbox ?? [],
        silent_leaders: email_pulse.silent_leaders ?? [],
        counts: {
          commitments: commitments.length,
          unowned_commitments: unowned,
          risks: risks.length,
          critical_risks: critical,
          escalations: Array.isArray(sigs.escalations) ? sigs.escalations.length : 0,
          board_mentions: Array.isArray(sigs.board_mentions) ? sigs.board_mentions.length : 0,
          customer_issues: Array.isArray(sigs.customer_issues) ? sigs.customer_issues.length : 0,
          vendor_signals: Array.isArray(sigs.vendor_signals) ? sigs.vendor_signals.length : 0,
        },
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
