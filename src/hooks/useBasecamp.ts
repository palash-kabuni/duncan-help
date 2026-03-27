import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BasecampProject {
  id: number;
  name: string;
  description: string;
  status: string;
  url: string;
  app_url: string;
  created_at: string;
  updated_at: string;
  dock: Array<{
    id: number;
    title: string;
    name: string;
    enabled: boolean;
    position: number;
    url: string;
    app_url: string;
  }>;
}

interface BasecampTodoList {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  completed_ratio: string;
  name: string;
  todos_url: string;
}

interface BasecampTodo {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  due_on: string | null;
  assignees: Array<{ id: number; name: string }>;
  creator: { id: number; name: string };
  created_at: string;
  starts_on: string | null;
}

interface BasecampMessage {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  creator: { id: number; name: string };
}

export function useBasecamp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callBasecampApi = useCallback(async (endpoint: string, method = "GET", body?: any, paginate = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("basecamp-api", {
        body: { endpoint, method, body, paginate },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.details ? `${data.error}: ${data.details}` : data.error);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async (): Promise<BasecampProject[] | null> => {
    return callBasecampApi("projects", "GET", undefined, true);
  }, [callBasecampApi]);

  const fetchTodoLists = useCallback(async (projectId: number, todoSetId: number): Promise<BasecampTodoList[] | null> => {
    return callBasecampApi(`buckets/${projectId}/todosets/${todoSetId}/todolists`, "GET", undefined, true);
  }, [callBasecampApi]);

  const fetchTodos = useCallback(async (projectId: number, todoListId: number, includeCompleted = true): Promise<BasecampTodo[] | null> => {
    if (!includeCompleted) {
      return callBasecampApi(`buckets/${projectId}/todolists/${todoListId}/todos`, "GET", undefined, true);
    }
    // Fetch both incomplete and completed todos
    const [incomplete, completed] = await Promise.all([
      callBasecampApi(`buckets/${projectId}/todolists/${todoListId}/todos`, "GET", undefined, true),
      callBasecampApi(`buckets/${projectId}/todolists/${todoListId}/todos?completed=true`, "GET", undefined, true),
    ]);
    const all: BasecampTodo[] = [];
    if (incomplete) all.push(...incomplete);
    if (completed) all.push(...completed);
    return all.length > 0 ? all : incomplete;
  }, [callBasecampApi]);

  const fetchMessages = useCallback(async (projectId: number, messageBoardId: number): Promise<BasecampMessage[] | null> => {
    return callBasecampApi(`buckets/${projectId}/message_boards/${messageBoardId}/messages`, "GET", undefined, true);
  }, [callBasecampApi]);

  return {
    loading,
    error,
    fetchProjects,
    fetchTodoLists,
    fetchTodos,
    fetchMessages,
    callBasecampApi,
  };
}

export type { BasecampProject, BasecampTodoList, BasecampTodo, BasecampMessage };
