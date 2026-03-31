import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BASECAMP_TOKEN_URL = "https://launchpad.37signals.com/authorization/token";

interface UserMapping {
  id: string;
  duncan_user_id: string;
  basecamp_person_id: number;
  basecamp_name: string;
  slack_user_identifier: string;
  is_active: boolean;
}

interface DigestItem {
  id: number;
  title: string;
  due_on?: string | null;
  project_name?: string;
  assignees?: string[];
}

interface UserDigest {
  user_id: string;
  slack_user_identifier: string;
  basecamp_name: string;
  due_today: DigestItem[];
  overdue: DigestItem[];
  new_tasks: DigestItem[];
  new_messages: Array<{ id: number; title: string; project_name: string; creator: string; created_at: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get active user mappings
    const { data: mappings, error: mapErr } = await supabaseAdmin
      .from("user_notification_mappings")
      .select("*")
      .eq("is_active", true);

    if (mapErr) throw new Error(`Failed to fetch mappings: ${mapErr.message}`);
    if (!mappings || mappings.length === 0) {
      return new Response(JSON.stringify({ message: "No active user mappings found", digests: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build lookup: basecamp_person_id → mapping
    const mappingsByPersonId = new Map<number, UserMapping>();
    for (const m of mappings as UserMapping[]) {
      mappingsByPersonId.set(m.basecamp_person_id, m);
    }

    // 2. Get Basecamp token
    const { data: tokenRow } = await supabaseAdmin
      .from("basecamp_tokens")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!tokenRow) {
      return new Response(JSON.stringify({ error: "Basecamp not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenRow.access_token;

    // Refresh if expired
    if (new Date(tokenRow.token_expiry) <= new Date()) {
      const clientId = Deno.env.get("BASECAMP_CLIENT_ID");
      const clientSecret = Deno.env.get("BASECAMP_CLIENT_SECRET");
      if (!clientId || !clientSecret) throw new Error("Basecamp OAuth credentials not configured");

      const refreshRes = await fetch(BASECAMP_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "refresh",
          refresh_token: tokenRow.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!refreshRes.ok) throw new Error("Failed to refresh Basecamp token");
      const refreshed = await refreshRes.json();
      accessToken = refreshed.access_token;

      await supabaseAdmin
        .from("basecamp_tokens")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || tokenRow.refresh_token,
          token_expiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", tokenRow.id);
    }

    const accountId = tokenRow.account_id || Deno.env.get("BASECAMP_ACCOUNT_ID");
    if (!accountId) throw new Error("Basecamp account ID not configured");

    const baseUrl = `https://3.basecampapi.com/${accountId}`;
    const basecampHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "Duncan (duncan.help)",
    };

    // Helper to fetch paginated
    async function fetchAllPages(url: string): Promise<any[]> {
      let allData: any[] = [];
      let nextUrl: string | null = url;
      while (nextUrl) {
        const res = await fetch(nextUrl, { headers: basecampHeaders });
        if (!res.ok) {
          console.error(`Basecamp API error [${res.status}]: ${await res.text()}`);
          break;
        }
        const data = await res.json();
        if (Array.isArray(data)) allData = allData.concat(data);
        else return [data];

        const link = res.headers.get("Link");
        nextUrl = null;
        if (link) {
          const m = link.match(/<([^>]+)>;\s*rel="next"/);
          if (m) nextUrl = m[1];
        }
      }
      return allData;
    }

    // 3. Fetch all projects
    const projects = await fetchAllPages(`${baseUrl}/projects.json`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    // Per-user digest accumulators
    const digestMap = new Map<number, UserDigest>();
    const unmappedPersons = new Map<number, string>(); // personId → name

    function getOrCreateDigest(personId: number): UserDigest | null {
      const mapping = mappingsByPersonId.get(personId);
      if (!mapping) {
        return null;
      }
      if (!digestMap.has(personId)) {
        digestMap.set(personId, {
          user_id: mapping.duncan_user_id,
          slack_user_identifier: mapping.slack_user_identifier,
          basecamp_name: mapping.basecamp_name,
          due_today: [],
          overdue: [],
          new_tasks: [],
          new_messages: [],
        });
      }
      return digestMap.get(personId)!;
    }

    // 4. Process each project
    for (const project of projects) {
      const dock = project.dock || [];
      const todoSet = dock.find((d: any) => d.name === "todoset" && d.enabled);
      const messageBoard = dock.find((d: any) => d.name === "message_board" && d.enabled);

      // Process todos
      if (todoSet) {
        const todoLists = await fetchAllPages(`${baseUrl}/buckets/${project.id}/todosets/${todoSet.id}/todolists.json`);

        for (const list of todoLists) {
          // Fetch incomplete todos
          const todos = await fetchAllPages(`${baseUrl}/buckets/${project.id}/todolists/${list.id}/todos.json`);

          for (const todo of todos) {
            if (todo.completed) continue;

            const assigneeIds: number[] = (todo.assignees || []).map((a: any) => a.id);
            const createdAt = new Date(todo.created_at);

            for (const personId of assigneeIds) {
              const digest = getOrCreateDigest(personId);
              if (!digest) {
                // Track unmapped
                const name = (todo.assignees || []).find((a: any) => a.id === personId)?.name || "Unknown";
                unmappedPersons.set(personId, name);
                continue;
              }

              const item: DigestItem = {
                id: todo.id,
                title: todo.title || todo.content,
                due_on: todo.due_on,
                project_name: project.name,
              };

              // Due today
              if (todo.due_on === todayStr) {
                digest.due_today.push(item);
              }

              // Overdue
              if (todo.due_on && todo.due_on < todayStr) {
                digest.overdue.push(item);
              }

              // New tasks (created in last 24h)
              if (createdAt >= yesterday) {
                digest.new_tasks.push(item);
              }
            }
          }
        }
      }

      // Process messages
      if (messageBoard) {
        const messages = await fetchAllPages(`${baseUrl}/buckets/${project.id}/message_boards/${messageBoard.id}/messages.json`);

        for (const msg of messages) {
          const createdAt = new Date(msg.created_at);
          if (createdAt < yesterday) continue;

          // Messages don't have assignees — notify all mapped users
          for (const [personId, mapping] of mappingsByPersonId) {
            const digest = getOrCreateDigest(personId);
            if (!digest) continue;

            digest.new_messages.push({
              id: msg.id,
              title: msg.title || msg.subject || "(No title)",
              project_name: project.name,
              creator: msg.creator?.name || "Unknown",
              created_at: msg.created_at,
            });
          }
        }
      }
    }

    // 5. Log unmapped users
    if (unmappedPersons.size > 0) {
      const unmappedRows = Array.from(unmappedPersons.entries()).map(([personId, name]) => ({
        basecamp_person_id: personId,
        basecamp_name: name,
        context: "morning_digest",
      }));

      await supabaseAdmin.from("unmapped_users_log").insert(unmappedRows);
    }

    // 6. Send digests (placeholder — log to DB)
    const digests: UserDigest[] = Array.from(digestMap.values());
    const nonEmptyDigests = digests.filter(
      (d) => d.due_today.length > 0 || d.overdue.length > 0 || d.new_tasks.length > 0 || d.new_messages.length > 0
    );

    if (nonEmptyDigests.length > 0) {
      const logRows = nonEmptyDigests.map((d) => ({
        user_id: d.user_id,
        slack_user_identifier: d.slack_user_identifier,
        payload: {
          basecamp_name: d.basecamp_name,
          due_today: d.due_today,
          overdue: d.overdue,
          new_tasks: d.new_tasks,
          new_messages: d.new_messages,
          generated_at: new Date().toISOString(),
        },
        status: "logged", // Will become "sent" when Slack is connected
        sent_at: new Date().toISOString(),
      }));

      await supabaseAdmin.from("slack_notification_logs").insert(logRows);
    }

    return new Response(
      JSON.stringify({
        message: "Morning digest generated",
        digests_generated: nonEmptyDigests.length,
        unmapped_users: unmappedPersons.size,
        digests: nonEmptyDigests,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Morning digest error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
