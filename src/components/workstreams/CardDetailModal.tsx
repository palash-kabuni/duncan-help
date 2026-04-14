import { useState, useRef, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  X, CalendarDays, User, Flag, Tag, Plus, Trash2, CheckCircle2,
  Circle, Send, MessageSquare, Activity, Clock, Loader2, Users,
  Check, XCircle,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  useWorkstreamCard, useUpdateCard, useUpdateCardAssignees, useCreateTask,
  useUpdateTask, useUpdateTaskAssignees, useDeleteTask,
  useAddComment, useDeleteComment, useDeleteCard, useUserProfiles,
  useRespondToAssignment,
  type CardStatus, type CardPriority, type WorkstreamTask,
} from "@/hooks/useWorkstreams";
import { StatusBadge, priorityConfig } from "./StatusBadge";
import MultiAssigneeSelect from "./MultiAssigneeSelect";
import { useAuth } from "@/hooks/useAuth";

interface CardDetailModalProps {
  cardId: string | null;
  onClose: () => void;
}

export default function CardDetailModal({ cardId, onClose }: CardDetailModalProps) {
  const { user } = useAuth();
  const { data, isLoading } = useWorkstreamCard(cardId);
  const { data: users } = useUserProfiles();
  const updateCard = useUpdateCard();
  const updateCardAssignees = useUpdateCardAssignees();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateTaskAssignees = useUpdateTaskAssignees();
  const deleteTask = useDeleteTask();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const deleteCard = useDeleteCard();
  const respondToAssignment = useRespondToAssignment();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [commentText, setCommentText] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!cardId) return null;

  const card = data?.card;
  const tasks = data?.tasks || [];
  const comments = data?.comments || [];
  const activity = data?.activity || [];

  // Check current user's assignment status
  const myAssignment = useMemo(() => {
    if (!card || !user) return null;
    return (card.assignees || []).find(a => a.user_id === user.id) || null;
  }, [card, user]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !cardId) return;
    createTask.mutate({
      card_id: cardId,
      title: newTaskTitle.trim(),
      sort_order: tasks.length,
    });
    setNewTaskTitle("");
  };

  const handleToggleTask = (task: WorkstreamTask) => {
    updateTask.mutate({ id: task.id, card_id: task.card_id, completed: !task.completed });
  };

  const handleAddComment = () => {
    if (!commentText.trim() || !cardId) return;
    addComment.mutate({ card_id: cardId, content: commentText.trim() });
    setCommentText("");
  };

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    if (!cardId || !editingField) return;
    updateCard.mutate({ id: cardId, [editingField]: editValue || null });
    setEditingField(null);
  };

  const handleDelete = () => {
    if (!cardId) return;
    if (confirm("Delete this card? This cannot be undone.")) {
      deleteCard.mutate(cardId);
      onClose();
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case "status_changed": return <Flag className="h-3 w-3 text-amber-500" />;
      case "task_added": return <Plus className="h-3 w-3 text-emerald-500" />;
      case "task_completed": return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
      case "comment_added": return <MessageSquare className="h-3 w-3 text-primary" />;
      case "assignment_accepted": return <Check className="h-3 w-3 text-emerald-500" />;
      case "assignment_declined": return <XCircle className="h-3 w-3 text-red-500" />;
      default: return <Activity className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getActivityLabel = (action: string, details: Record<string, any>) => {
    switch (action) {
      case "card_created": return "Created this card";
      case "status_changed": return `Changed status to ${details.new_status}`;
      case "task_added": return `Added task "${details.title}"`;
      case "task_completed": return "Completed a task";
      case "task_uncompleted": return "Uncompleted a task";
      case "comment_added": return "Added a comment";
      case "assignment_accepted": return "Accepted the assignment";
      case "assignment_declined": return `Declined the assignment${details.decline_reason ? `: "${details.decline_reason}"` : ""}`;
      default: return action.replace(/_/g, " ");
    }
  };

  return (
    <Dialog open={!!cardId} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        {isLoading || !card ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editingField === "title" ? (
                    <Input
                      ref={inputRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={e => e.key === "Enter" && saveEdit()}
                      className="text-lg font-bold"
                    />
                  ) : (
                    <h2
                      className="text-lg font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => startEdit("title", card.title)}
                    >
                      {card.title}
                    </h2>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={card.status} size="md" />
                    {card.project_tag && (
                      <span className="text-[10px] font-mono bg-secondary text-muted-foreground px-2 py-0.5 rounded-md">
                        {card.project_tag}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Status selector */}
              <div className="flex items-center gap-2 mt-4">
                <Label className="text-xs text-muted-foreground">Status:</Label>
                {(["red", "amber", "green", "done"] as CardStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => updateCard.mutate({ id: card.id, status: s })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                      card.status === s
                        ? s === "red" ? "bg-red-500/15 text-red-500 border-red-500/30"
                          : s === "amber" ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                          : s === "green" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                          : "bg-primary/15 text-primary border-primary/30"
                        : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    {s === "red" ? "🔴" : s === "amber" ? "🟡" : s === "green" ? "🟢" : "✅"} {s === "amber" ? "Yellow" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Body with tabs */}
            <ScrollArea className="flex-1">
              <div className="px-6 py-4">
                {/* Meta row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="space-y-1 col-span-2">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                      <Users className="h-3.5 w-3.5" /> Assignees
                    </div>
                    <MultiAssigneeSelect
                      users={users || []}
                      selectedIds={(card.assignees || []).map(a => a.user_id)}
                      onChange={(ids) => updateCardAssignees.mutate({ cardId: card.id, userIds: ids })}
                      compact
                    />
                  </div>

                  <MetaField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Due Date" value={card.due_date ? format(new Date(card.due_date), "MMM d, yyyy") : "None"}>
                    <Input
                      type="date"
                      value={card.due_date || ""}
                      onChange={e => updateCard.mutate({ id: card.id, due_date: e.target.value || null })}
                      className="h-7 text-xs"
                    />
                  </MetaField>

                  <MetaField icon={<Tag className="h-3.5 w-3.5" />} label="Project" value={card.project_tag || "None"}>
                    <Select value={card.project_tag || "none"} onValueChange={v => updateCard.mutate({ id: card.id, project_tag: v === "none" ? null : v })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="Lightning Strike Event">Lightning Strike Event</SelectItem>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="K10 App">K10 App</SelectItem>
                        <SelectItem value="School Integrations">School Integrations</SelectItem>
                      </SelectContent>
                    </Select>
                  </MetaField>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</Label>
                  {editingField === "description" ? (
                    <Textarea
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      className="min-h-[80px] text-sm"
                      autoFocus
                    />
                  ) : (
                    <div
                      className="text-sm text-foreground/80 cursor-pointer hover:bg-secondary/30 rounded-lg p-2 -ml-2 transition-colors min-h-[40px]"
                      onClick={() => startEdit("description", card.description)}
                    >
                      {card.description || <span className="text-muted-foreground italic">Click to add description…</span>}
                    </div>
                  )}
                </div>

                <Separator className="mb-5" />

                <Tabs defaultValue="tasks">
                  <TabsList className="mb-4">
                    <TabsTrigger value="tasks" className="text-xs gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Tasks ({tasks.length})
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="text-xs gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Comments ({comments.length})
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Activity
                    </TabsTrigger>
                  </TabsList>

                  {/* Tasks Tab */}
                  <TabsContent value="tasks" className="space-y-2">
                    {tasks.map(task => (
                      <div key={task.id} className="flex items-start gap-2 group rounded-lg border border-border/60 bg-card/50 p-2.5">
                        <button onClick={() => handleToggleTask(task)} className="mt-0.5 shrink-0">
                          {task.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.title}
                          </span>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {(task.assignees || []).map(a => (
                              <Badge key={a.user_id} variant="secondary" className="text-[10px] py-0 px-1.5">
                                {(a.display_name || "?").split(" ")[0]}
                              </Badge>
                            ))}
                            {task.due_date && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <CalendarDays className="h-2.5 w-2.5" /> {format(new Date(task.due_date), "MMM d")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-[120px]">
                            <MultiAssigneeSelect
                              users={users || []}
                              selectedIds={(task.assignees || []).map(a => a.user_id)}
                              onChange={(ids) => updateTaskAssignees.mutate({ taskId: task.id, cardId: task.card_id, userIds: ids })}
                              compact
                              placeholder="Assign"
                            />
                          </div>
                          <button
                            onClick={() => deleteTask.mutate({ id: task.id, card_id: task.card_id })}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add task input */}
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        placeholder="Add a task…"
                        className="text-sm h-9"
                        onKeyDown={e => e.key === "Enter" && handleAddTask()}
                      />
                      <Button size="sm" variant="outline" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Comments Tab */}
                  <TabsContent value="comments" className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="group rounded-lg border border-border/60 bg-card/50 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-foreground">{c.user_name || "Unknown"}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                            </span>
                            {c.user_id === user?.id && (
                              <button
                                onClick={() => deleteComment.mutate({ id: c.id, card_id: c.card_id })}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))}

                    {comments.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
                    )}

                    <div className="flex items-start gap-2 pt-1">
                      <Textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Write a comment…"
                        className="text-sm min-h-[60px]"
                      />
                      <Button size="sm" onClick={handleAddComment} disabled={!commentText.trim()}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Activity Tab */}
                  <TabsContent value="activity">
                    <div className="space-y-2">
                      {activity.map(a => (
                        <div key={a.id} className="flex items-start gap-2.5 py-1.5">
                          <div className="mt-0.5">{getActivityIcon(a.action)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground/80">
                              <span className="font-medium text-foreground">{a.user_name || "System"}</span>{" "}
                              {getActivityLabel(a.action, a.details)}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      ))}
                      {activity.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Footer actions */}
                <Separator className="my-5" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-2">
                  <span>Created {card.created_at ? formatDistanceToNow(new Date(card.created_at), { addSuffix: true }) : "—"}</span>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs" onClick={handleDelete}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete Card
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetaField({ icon, label, value, children }: {
  icon: React.ReactNode; label: string; value: string; children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
        {icon} {label}
      </div>
      {editing ? (
        <div onBlur={() => setTimeout(() => setEditing(false), 200)}>
          {children}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-foreground hover:text-primary transition-colors text-left w-full truncate"
        >
          {value}
        </button>
      )}
    </div>
  );
}
