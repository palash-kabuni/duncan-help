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

    // Get user profile (including last_briefing_at from preferences)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, role_title, department, preferences")
      .eq("user_id", user.id)
      .maybeSingle();

    const displayName = profile?.display_name || userName;
    const firstName = displayName.toLowerCase().split(" ")[0];
    const now = new Date();

    // Determine the "since" window — use last_briefing_at if available, otherwise default 48h
    const prefs = (profile?.preferences as Record<string, any>) || {};
    const lastBriefingAt = prefs.last_briefing_at
      ? new Date(prefs.last_briefing_at)
      : null;

    // For time-sensitive data (meetings, work items), use since last briefing or 48h
    const defaultSince = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sinceDatetime = lastBriefingAt && lastBriefingAt > defaultSince
      ? lastBriefingAt
      : defaultSince;
    const sinceISO = sinceDatetime.toISOString();

    // For slower-moving data (POs, issues, candidates), use a wider window
    const widerDefault = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const widerSince = lastBriefingAt && lastBriefingAt > widerDefault
      ? lastBriefingAt
      : widerDefault;
    const widerSinceISO = widerSince.toISOString();

    // Run ALL queries in parallel
    const [
      meetingsResult,
      workItemsResult,
      invoicesResult,
      basecampData,
      calendarResult,
      purchaseOrdersResult,
      issuesResult,
      candidatesResult,
      wikiResult,
    ] = await Promise.all([
      // 1. Meetings since last briefing
      supabaseAdmin
        .from("meetings")
        .select("id, title, meeting_date, summary, action_items, analysis, status")
        .gte("meeting_date", sinceISO)
        .order("meeting_date", { ascending: false })
        .limit(10),

      // 2. Azure DevOps work items changed since last briefing
      supabaseAdmin
        .from("azure_work_items")
        .select("external_id, title, state, work_item_type, priority, changed_date, project_name, assigned_to")
        .or(`assigned_to.ilike.%${displayName}%,assigned_to.ilike.%${userEmail}%`)
        .gte("changed_date", sinceISO)
        .order("changed_date", { ascending: false })
        .limit(15),

      // 3. Outstanding Xero invoices (always show current state)
      supabaseAdmin
        .from("xero_invoices")
        .select("invoice_number, contact_name, total, amount_due, due_date, status, type, currency_code")
        .in("status", ["AUTHORISED", "SUBMITTED"])
        .order("due_date", { ascending: true })
        .limit(10),

      // 4. Basecamp todos + messages
      fetchBasecampData(supabaseUrl, supabaseAdmin, authHeader, displayName),

      // 5. Google Calendar - today's events
      fetchCalendarEvents(supabaseUrl, supabaseAdmin, authHeader, user.id),

      // 6. Purchase orders
      fetchPurchaseOrders(supabaseAdmin, user.id),

      // 7. Issues (since last briefing or 7 days)
      supabaseAdmin
        .from("issues")
        .select("id, title, issue_type, severity, frequency, created_at, updated_at")
        .eq("user_id", user.id)
        .gte("updated_at", widerSinceISO)
        .order("updated_at", { ascending: false })
        .limit(10),

      // 8. Candidates updated since last briefing
      fetchRecruitmentUpdates(supabaseAdmin, user.id, widerSinceISO),

      // 9. Wiki pages updated since last briefing
      supabaseAdmin
        .from("wiki_pages")
        .select("id, title, summary, updated_at, tags")
        .eq("is_published", true)
        .gte("updated_at", widerSinceISO)
        .order("updated_at", { ascending: false })
        .limit(10),

    ]);

    // Update last_briefing_at in preferences
    const updatedPrefs = { ...prefs, last_briefing_at: now.toISOString() };
    await supabaseAdmin
      .from("profiles")
      .update({ preferences: updatedPrefs })
      .eq("user_id", user.id);

    // Extract action items assigned to user from meetings
    const userActionItems: any[] = [];
    if (meetingsResult.data) {
      for (const meeting of meetingsResult.data) {
        if (meeting.action_items && Array.isArray(meeting.action_items)) {
          for (const item of meeting.action_items as any[]) {
            const assignee = (item.assignee || item.owner || "").toLowerCase();
            if (
              assignee.includes(firstName) ||
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

    // Build comprehensive briefing data
    const briefing = {
      user: {
        name: displayName,
        role: profile?.role_title || null,
        department: profile?.department || null,
      },
      since: lastBriefingAt ? lastBriefingAt.toISOString() : null,
      is_first_briefing: !lastBriefingAt,
      calendar: {
        todays_events: calendarResult || [],
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
      purchase_orders: purchaseOrdersResult || { my_pending: [], awaiting_my_approval: [] },
      issues: {
        my_recent: issuesResult.data?.map((i) => ({
          title: i.title,
          type: i.issue_type,
          severity: i.severity,
          created: i.created_at,
        })) || [],
      },
      recruitment: {
        active_candidates: candidatesResult || [],
      },
      basecamp: basecampData || { my_todos: [], messages_mentioning_me: [] },
      wiki: {
        recently_updated: wikiResult.data?.map((w) => ({
          title: w.title,
          summary: w.summary,
          updated: w.updated_at,
          tags: w.tags,
        })) || [],
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

// ── Helper: Fetch Google Calendar events for today ──
async function fetchCalendarEvents(
  supabaseUrl: string,
  supabaseAdmin: any,
  authHeader: string,
  userId: string
): Promise<any[]> {
  try {
    const { data: calToken } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!calToken) return [];

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const resp = await fetch(`${supabaseUrl}/functions/v1/google-calendar-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        action: "list",
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        maxResults: 20,
      }),
    });

    if (!resp.ok) return [];
    const result = await resp.json();
    const events = result.items || result || [];
    if (!Array.isArray(events)) return [];

    return events.map((e: any) => ({
      title: e.summary || "No title",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || null,
      attendees: e.attendees?.length || 0,
    }));
  } catch (err) {
    console.error("Calendar briefing error:", err);
    return [];
  }
}

// ── Helper: Fetch purchase orders relevant to user ──
async function fetchPurchaseOrders(supabaseAdmin: any, userId: string) {
  try {
    const [myPOs, deptResult] = await Promise.all([
      supabaseAdmin
        .from("purchase_orders")
        .select("po_number, vendor_name, description, total_amount, status, category, created_at")
        .eq("requester_id", userId)
        .in("status", ["draft", "pending_approval", "approved"])
        .order("created_at", { ascending: false })
        .limit(10),

      supabaseAdmin
        .from("departments")
        .select("id")
        .eq("owner_user_id", userId),
    ]);

    let awaitingApproval: any[] = [];
    if (deptResult.data && deptResult.data.length > 0) {
      const deptIds = deptResult.data.map((d: any) => d.id);
      const { data: pendingPOs } = await supabaseAdmin
        .from("purchase_orders")
        .select("po_number, vendor_name, description, total_amount, status, category, created_at")
        .in("department_id", deptIds)
        .eq("status", "pending_approval")
        .neq("requester_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      awaitingApproval = pendingPOs || [];
    }

    return {
      my_pending: myPOs.data?.map((p: any) => ({
        po_number: p.po_number,
        vendor: p.vendor_name,
        amount: p.total_amount,
        status: p.status,
        category: p.category,
      })) || [],
      awaiting_my_approval: awaitingApproval.map((p: any) => ({
        po_number: p.po_number,
        vendor: p.vendor_name,
        amount: p.total_amount,
        category: p.category,
      })),
    };
  } catch (err) {
    console.error("PO briefing error:", err);
    return { my_pending: [], awaiting_my_approval: [] };
  }
}

// ── Helper: Fetch recruitment updates for jobs the user created ──
async function fetchRecruitmentUpdates(supabaseAdmin: any, userId: string, since: string) {
  try {
    const { data: userJobs } = await supabaseAdmin
      .from("job_roles")
      .select("id, title")
      .eq("created_by", userId)
      .eq("status", "active");

    if (!userJobs || userJobs.length === 0) return [];

    const jobIds = userJobs.map((j: any) => j.id);
    const jobMap = Object.fromEntries(userJobs.map((j: any) => [j.id, j.title]));

    const { data: candidates } = await supabaseAdmin
      .from("candidates")
      .select("name, email, status, total_score, job_role_id, updated_at, hireflix_status")
      .in("job_role_id", jobIds)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(15);

    return (candidates || []).map((c: any) => ({
      name: c.name,
      status: c.status,
      score: c.total_score,
      job_title: jobMap[c.job_role_id] || "Unknown role",
      interview_status: c.hireflix_status,
      updated: c.updated_at,
    }));
  } catch (err) {
    console.error("Recruitment briefing error:", err);
    return [];
  }
}

// ── Helper: Fetch Basecamp todos + messages mentioning user ──
async function fetchBasecampData(
  supabaseUrl: string,
  supabaseAdmin: any,
  authHeader: string,
  displayName: string
) {
  try {
    const { data: basecampToken } = await supabaseAdmin
      .from("basecamp_tokens")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!basecampToken) return { my_todos: [], messages_mentioning_me: [] };

    const projectsResp = await fetch(`${supabaseUrl}/functions/v1/basecamp-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ endpoint: "projects", method: "GET", paginate: true }),
    });

    if (!projectsResp.ok) return { my_todos: [], messages_mentioning_me: [] };
    const projects = await projectsResp.json();
    if (!Array.isArray(projects) || projects.length === 0) return { my_todos: [], messages_mentioning_me: [] };

    const firstNameLower = displayName.toLowerCase().split(" ")[0];

    const results = await Promise.all(
      projects.slice(0, 3).map(async (project: any) => {
        const todoSet = project.dock?.find((d: any) => d.name === "todoset" && d.enabled);
        const messageBoard = project.dock?.find((d: any) => d.name === "message_board" && d.enabled);

        const [todos, messages] = await Promise.all([
          todoSet ? fetchProjectTodos(supabaseUrl, authHeader, project, todoSet) : Promise.resolve([]),
          messageBoard ? fetchProjectMessages(supabaseUrl, authHeader, project, messageBoard, firstNameLower) : Promise.resolve([]),
        ]);

        return { todos, messages };
      })
    );

    const allTodos = results.flatMap((r) => r.todos);
    const allMessages = results.flatMap((r) => r.messages);

    const myTodos = allTodos.filter((t: any) => {
      if (t.assignees.length === 0) return true;
      return t.assignees.some((a: string) => a.toLowerCase().includes(firstNameLower));
    }).slice(0, 15);

    return {
      my_todos: myTodos,
      messages_mentioning_me: allMessages.slice(0, 10),
    };
  } catch (err) {
    console.error("Basecamp briefing error:", err);
    return { my_todos: [], messages_mentioning_me: [] };
  }
}

async function fetchProjectTodos(supabaseUrl: string, authHeader: string, project: any, todoSet: any) {
  try {
    const listsResp = await fetch(`${supabaseUrl}/functions/v1/basecamp-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        endpoint: `buckets/${project.id}/todosets/${todoSet.id}/todolists`,
        method: "GET",
        paginate: true,
      }),
    });

    if (!listsResp.ok) return [];
    const lists = await listsResp.json();
    if (!Array.isArray(lists)) return [];

    const todosFromLists = await Promise.all(
      lists.slice(0, 2).map(async (list: any) => {
        const todosResp = await fetch(`${supabaseUrl}/functions/v1/basecamp-api`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
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
  } catch {
    return [];
  }
}

async function fetchProjectMessages(
  supabaseUrl: string,
  authHeader: string,
  project: any,
  messageBoard: any,
  firstName: string
) {
  try {
    const msgsResp = await fetch(`${supabaseUrl}/functions/v1/basecamp-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        endpoint: `buckets/${project.id}/message_boards/${messageBoard.id}/messages`,
        method: "GET",
        paginate: true,
      }),
    });

    if (!msgsResp.ok) return [];
    const messages = await msgsResp.json();
    if (!Array.isArray(messages)) return [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return messages
      .filter((m: any) => {
        if (m.created_at < sevenDaysAgo) return false;
        const content = ((m.content || "") + " " + (m.title || "")).toLowerCase();
        return content.includes(firstName);
      })
      .slice(0, 5)
      .map((m: any) => ({
        title: m.title,
        project_name: project.name,
        author: m.creator?.name || "Unknown",
        created_at: m.created_at,
      }));
  } catch {
    return [];
  }
}
