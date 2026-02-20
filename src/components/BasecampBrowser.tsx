import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, FolderOpen, CheckSquare, MessageSquare, ChevronRight, ChevronDown, Circle, CheckCircle2, User } from "lucide-react";
import { useBasecamp, type BasecampProject, type BasecampTodoList, type BasecampTodo, type BasecampMessage } from "@/hooks/useBasecamp";

interface BasecampBrowserProps {
  onProjectData?: (data: any) => void;
}

const BasecampBrowser = ({ onProjectData }: BasecampBrowserProps) => {
  const { loading, error, fetchProjects, fetchTodoLists, fetchTodos, fetchMessages } = useBasecamp();
  const [projects, setProjects] = useState<BasecampProject[]>([]);
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [todoLists, setTodoLists] = useState<Record<number, BasecampTodoList[]>>({});
  const [todos, setTodos] = useState<Record<number, BasecampTodo[]>>({});
  const [messages, setMessages] = useState<Record<number, BasecampMessage[]>>({});
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, "todos" | "messages">>({});
  const [expandedTodoList, setExpandedTodoList] = useState<number | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const data = await fetchProjects();
    if (data) {
      setProjects(data);
      onProjectData?.(data);
    }
  };

  const toggleProject = async (project: BasecampProject) => {
    if (expandedProject === project.id) {
      setExpandedProject(null);
      return;
    }
    setExpandedProject(project.id);
    setActiveTab((prev) => ({ ...prev, [project.id]: "todos" }));

    // Find todoset dock item
    const todoSet = project.dock?.find((d) => d.name === "todoset" && d.enabled);
    if (todoSet && !todoLists[project.id]) {
      setLoadingSection(`todos-${project.id}`);
      const lists = await fetchTodoLists(project.id, todoSet.id);
      if (lists) setTodoLists((prev) => ({ ...prev, [project.id]: lists }));
      setLoadingSection(null);
    }
  };

  const loadTodos = async (projectId: number, todoListId: number) => {
    if (expandedTodoList === todoListId) {
      setExpandedTodoList(null);
      return;
    }
    setExpandedTodoList(todoListId);
    if (!todos[todoListId]) {
      setLoadingSection(`todolist-${todoListId}`);
      const items = await fetchTodos(projectId, todoListId);
      if (items) setTodos((prev) => ({ ...prev, [todoListId]: items }));
      setLoadingSection(null);
    }
  };

  const loadMessages = async (project: BasecampProject) => {
    setActiveTab((prev) => ({ ...prev, [project.id]: "messages" }));
    const messageBoard = project.dock?.find((d) => d.name === "message_board" && d.enabled);
    if (messageBoard && !messages[project.id]) {
      setLoadingSection(`messages-${project.id}`);
      const msgs = await fetchMessages(project.id, messageBoard.id);
      if (msgs) setMessages((prev) => ({ ...prev, [project.id]: msgs }));
      setLoadingSection(null);
    }
  };

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading Basecamp projects...</span>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
        Projects ({projects.length})
      </h3>
      {projects.map((project) => (
        <div key={project.id} className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => toggleProject(project)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
          >
            {expandedProject === project.id ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <FolderOpen className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
              {project.description && (
                <p className="text-[10px] text-muted-foreground truncate">{project.description}</p>
              )}
            </div>
          </button>

          {expandedProject === project.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="border-t border-border"
            >
              {/* Tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab((prev) => ({ ...prev, [project.id]: "todos" }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab[project.id] === "todos"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CheckSquare className="h-3 w-3" />
                  To-dos
                </button>
                <button
                  onClick={() => loadMessages(project)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab[project.id] === "messages"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  Messages
                </button>
              </div>

              <div className="p-3 max-h-80 overflow-y-auto">
                {activeTab[project.id] === "todos" && (
                  <>
                    {loadingSection === `todos-${project.id}` ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    ) : todoLists[project.id]?.length ? (
                      <div className="space-y-1">
                        {todoLists[project.id].map((list) => (
                          <div key={list.id}>
                            <button
                              onClick={() => loadTodos(project.id, list.id)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/30 transition-colors text-left"
                            >
                              {expandedTodoList === list.id ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="text-xs font-medium text-foreground">{list.title}</span>
                              {list.completed_ratio && (
                                <span className="text-[10px] text-muted-foreground ml-auto">{list.completed_ratio}</span>
                              )}
                            </button>
                            {expandedTodoList === list.id && (
                              <div className="ml-5 mt-1 space-y-0.5">
                                {loadingSection === `todolist-${list.id}` ? (
                                  <div className="flex items-center py-2">
                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                  </div>
                                ) : todos[list.id]?.length ? (
                                  todos[list.id].map((todo) => (
                                    <div key={todo.id} className="flex items-start gap-2 px-2 py-1 rounded">
                                      {todo.completed ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-norman-success shrink-0 mt-0.5" />
                                      ) : (
                                        <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                      )}
                                      <div className="min-w-0">
                                        <p className={`text-xs ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                          {todo.title}
                                        </p>
                                        {todo.assignees?.length > 0 && (
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <User className="h-2.5 w-2.5 text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground">
                                              {todo.assignees.map((a) => a.name).join(", ")}
                                            </span>
                                          </div>
                                        )}
                                        {todo.due_on && (
                                          <span className="text-[10px] text-muted-foreground">
                                            Due: {new Date(todo.due_on).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-muted-foreground px-2 py-1">No to-dos</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No to-do lists found</p>
                    )}
                  </>
                )}

                {activeTab[project.id] === "messages" && (
                  <>
                    {loadingSection === `messages-${project.id}` ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    ) : messages[project.id]?.length ? (
                      <div className="space-y-2">
                        {messages[project.id].map((msg) => (
                          <div key={msg.id} className="rounded-lg border border-border p-3">
                            <p className="text-xs font-medium text-foreground">{msg.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground">{msg.creator?.name}</span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(msg.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No messages found</p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
};

export default BasecampBrowser;
