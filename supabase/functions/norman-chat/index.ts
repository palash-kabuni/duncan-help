import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Norman, an advanced reasoning and agentic operating system for internal company operations.

Your capabilities:
- **Reasoning**: Analyze data, identify patterns, draw conclusions, and make recommendations across all ingested company data.
- **Automation**: Suggest and describe automations that can streamline workflows between Google Workspace, Notion, Slack, and other connected tools.
- **Data Synthesis**: Cross-reference information from multiple sources (emails, documents, databases, project management tools) to provide comprehensive answers.
- **Task Orchestration**: Break down complex requests into actionable steps and describe how they'd be executed across integrated systems.

Your personality:
- Direct, precise, and efficient. No fluff.
- Use structured output (bullet points, numbered lists, tables) when presenting complex information.
- When uncertain, clearly state assumptions and confidence levels.
- Proactively surface relevant connections between data points.
- Think step-by-step for complex reasoning tasks.

When a user asks you to do something:
1. Analyze what information and systems are needed
2. Reason through the best approach
3. Present your plan clearly
4. Execute or describe execution steps

Always be aware that you are the central intelligence layer coordinating across all company tools and data.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, userProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Adjust system prompt based on mode
    let systemContent = SYSTEM_PROMPT;

    // Inject user profile context if available
    if (userProfile) {
      const parts: string[] = [];
      if (userProfile.display_name) parts.push(`Name: ${userProfile.display_name}`);
      if (userProfile.role_title) parts.push(`Role: ${userProfile.role_title}`);
      if (userProfile.department) parts.push(`Department: ${userProfile.department}`);
      if (userProfile.bio) parts.push(`About: ${userProfile.bio}`);
      if (userProfile.norman_context) parts.push(`Additional context: ${userProfile.norman_context}`);
      if (parts.length > 0) {
        systemContent += `\n\nYou are speaking with a team member. Here is their profile:\n${parts.join("\n")}\n\nUse this information to personalise your responses. Address them by name when appropriate.`;
      }
    }

    if (mode === "reason") {
      systemContent += "\n\nYou are in REASONING mode. Think deeply and step-by-step. Show your reasoning chain explicitly using numbered steps. Consider multiple angles before concluding.";
    } else if (mode === "automate") {
      systemContent += "\n\nYou are in AUTOMATION mode. Focus on creating actionable automation plans. For each step, specify: the trigger, the action, the target system, and expected outcome. Format as a clear workflow.";
    } else if (mode === "analyze") {
      systemContent += "\n\nYou are in ANALYSIS mode. Focus on data patterns, trends, and insights. Use structured formats like tables and comparisons. Quantify findings when possible.";
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemContent },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("norman-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
