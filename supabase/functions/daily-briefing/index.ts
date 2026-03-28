import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
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
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = user.email || "";
    const userName = user.user_metadata?.display_name || userEmail;

    // Get user profile for matching
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, role_title, department")
      .eq("user_id", user.id)
      .maybeSingle();

    const displayName = profile?.display_name || userName;
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // Run all queries in parallel
    const [meetingsResult, workItemsResult, invoicesResult, basecampTodosResult] = await Promise.all([
      // Recent meetings with action items
      supabaseAdmin
        .from("meetings")
        .select("id, title, meeting_date, summary, action_items, analysis, status")
        .gte("meeting_date", twoDaysAgo)
        .order("meeting_date", { ascending: false })
        .limit(10),

      // Azure DevOps work items assigned to user (recently changed)
      supabaseAdmin
        .from("azure_work_items")
        .select("external_id, title, state, work_item_type, priority, changed_date, project_name, assigned_to")
        .or(`assigned_to.ilike.%${displayName}%,assigned_to.ilike.%${userEmail}%`)
        .gte("changed_date", twoDaysAgo)
        .order("changed_date", { ascending: false })
        .limit(15),

      // Outstanding Xero invoices
      supabaseAdmin
        .from("xero_invoices")
        .select("invoice_number, contact_name, total, amount_due, due_date, status, type, currency_code")
        .in("status", ["AUTHORISED", "SUBMITTED"])
        .order("due_date", { ascending: true })
        .limit(10),

      // Fetch Basecamp todos via the proxy (if connected)
      (async () => {
        try {
          const { data: basecampToken } = await supabaseAdmin
            .from("basecamp_tokens")
            .select("id")
            .limit(1)
            .maybeSingle();
          
          if (!basecampToken) return null;

          // Call basecamp-api to get projects, then extract recent todos
          const projectsResp = await fetch(`${supabaseUrl}/functions/v1/basecamp-api`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({ endpoint: "projects", method: "GET", paginate: true }),
          });

          if (!projectsResp.ok) return null;
          const projects = await projectsResp.json();
          if (!Array.isArray(projects) || projects.length === 0) return null;

          // Get todos from first 3 projects
          const todoPromises = projects.slice(0, 3).map(async (project: any) => {
            const todoSet = project.dock?.find((d: any) => d.name === "todoset" && d.enabled);
            if (!todoSet) return [];

            const listsResp = await fetch(`${supabaseUrl}/functions/v1/basecamp-api`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
              },
              body: JSON.stringify({
                endpoint: `buckets/${project.id}/todosets/${todoSet.id}/todolists`,
                method: "GET",
                paginate: true,
              }),
            });

            if (!listsResp.ok) return [];
            const lists = await listsResp.json();
            if (!Array.isArray(lists)) return [];

            // Get todos from first 2 lists per project
            const todosFromLists = await Promise.all(
              lists.slice(0, 2).map(async (list: any) => {
                const todosResp = await fetch(`${supabaseUrl}/functions/v1/basecamp-api`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                  },
                  body: JSON.stringify({
                    endpoint: `buckets/${project.id}/todolists/${list.id}/todos`,
                    method: "GET",
                    paginate: true,
                  }),
                });

                if (!todosResp.ok) return [];
                const todos = await todosResp.json();
                if (!Array.isArray(todos)) return [];

                return todos
                  .filter((t: any) => !t.completed)
                  .map((t: any) => ({
                    title: t.title,
                    due_on: t.due_on,
                    project_name: project.name,
                    list_name: list.title,
                    assignees: t.assignees?.map((a: any) => a.name) || [],
                  }));
              })
            );

            return todosFromLists.flat();
          });

          const allTodos = (await Promise.all(todoPromises)).flat();
          // Filter to todos assigned to or relevant to the user
          return allTodos.filter((t: any) => {
            if (t.assignees.length === 0) return true; // unassigned = relevant to all
            return t.assignees.some((a: string) =>
              a.toLowerCase().includes(displayName.toLowerCase().split(" ")[0])
            );
          }).slice(0, 15);
        } catch (err) {
          console.error("Basecamp briefing error:", err);
          return null;
        }
      })(),
    ]);

    // Extract action items assigned to user from meetings
    const userActionItems: any[] = [];
    if (meetingsResult.data) {
      for (const meeting of meetingsResult.data) {
        if (meeting.action_items && Array.isArray(meeting.action_items)) {
          for (const item of meeting.action_items as any[]) {
            const assignee = (item.assignee || item.owner || "").toLowerCase();
            if (
              assignee.includes(displayName.toLowerCase().split(" ")[0]) ||
              assignee.includes(userEmail.toLowerCase())
            ) {
              userActionItems.push({
                action: item.action || item.title || item.description,
                meeting_title: meeting.title,
                meeting_date: meeting.meeting_date,
                due: item.due_date || item.deadline || null,
              });
            }
          }
        }
      }
    }

    // Build briefing data
    const briefing = {
      user: {
        name: displayName,
        role: profile?.role_title || null,
        department: profile?.department || null,
      },
      meetings: {
        recent: meetingsResult.data?.map((m) => ({
          title: m.title,
          date: m.meeting_date,
          summary: m.summary,
          status: m.status,
        })) || [],
        my_action_items: userActionItems,
      },
      work_items: {
        recently_changed: workItemsResult.data?.map((w) => ({
          id: w.external_id,
          title: w.title,
          state: w.state,
          type: w.work_item_type,
          priority: w.priority,
          project: w.project_name,
        })) || [],
      },
      invoices: {
        outstanding: invoicesResult.data?.map((inv) => ({
          number: inv.invoice_number,
          contact: inv.contact_name,
          total: inv.total,
          amount_due: inv.amount_due,
          due_date: inv.due_date,
          type: inv.type === "ACCPAY" ? "Bill to pay" : "Receivable",
          currency: inv.currency_code,
        })) || [],
      },
      basecamp: {
        my_todos: basecampTodosResult || [],
      },
      generated_at: now.toISOString(),
    };

    return new Response(JSON.stringify(briefing), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-briefing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
