import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, MessageSquare, Send, Loader2, Settings2,
  Upload, FileText, CheckSquare, Square, Sparkles, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Sidebar, { MobileMenuButton } from "@/components/Sidebar";
import { useProjects, useProjectChats, useProjectChat, useProjectFiles } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import duncanAvatar from "@/assets/duncan-avatar.jpeg";

export default function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, loading: projectsLoading, updateProject } = useProjects();
  const project = projects.find(p => p.id === projectId) || null;
  const { chats, loading: chatsLoading, createChat, updateChatTitle } = useProjectChats(projectId || null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const { messages, loading: msgsLoading, sending, sendMessage } = useProjectChat(activeChatId);
  const { files, uploadFile, extractText, isUploading, isExtracting } = useProjectFiles(projectId || null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoCreatedRef = useRef(false);

  // Auto-create first chat if none exist
  useEffect(() => {
    if (!chatsLoading && chats.length === 0 && projectId && !autoCreatedRef.current) {
      autoCreatedRef.current = true;
      createChat("New Chat").then(chat => {
        if (chat) setActiveChatId(chat.id);
      });
    }
  }, [chatsLoading, chats.length, projectId, createChat]);

  // Reset auto-created flag when project changes
  useEffect(() => {
    autoCreatedRef.current = false;
  }, [projectId]);

  // Auto-select first chat
  useEffect(() => {
    if (chats.length > 0 && !activeChatId) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");

    // Auto-name chat on first message
    const isFirstMessage = messages.length === 0;

    const reply = await sendMessage(msg, selectedFileIds.length > 0 ? selectedFileIds : undefined);

    if (isFirstMessage && activeChatId && reply) {
      const title = msg.length > 50 ? msg.slice(0, 47) + "..." : msg;
      updateChatTitle(activeChatId, title);
    }
  }, [input, sending, sendMessage, selectedFileIds, messages.length, activeChatId, updateChatTitle]);

  const handleNewChat = async () => {
    const chat = await createChat();
    if (chat) setActiveChatId(chat.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId].slice(0, 5)
    );
  };

  const openSettings = () => {
    setEditName(project?.name || "");
    setEditPrompt(project?.system_prompt || "");
    setShowSettings(true);
  };

  const saveSettings = async () => {
    if (!projectId) return;
    await updateProject(projectId, { name: editName.trim(), system_prompt: editPrompt.trim() || null });
    setShowSettings(false);
  };

  if (!projectId) return null;

  // Show loading while projects are being fetched
  if (projectsLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <main className="flex-1 lg:ml-64 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  // Show not-found if project doesn't exist after loading
  if (!project) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <main className="flex-1 lg:ml-64 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">Project not found</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </main>
      </div>
    );
  }

  const selectedFiles = files.filter(f => selectedFileIds.includes(f.id));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="flex-1 lg:ml-64 flex flex-col min-h-0">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />
          <button onClick={() => navigate("/projects")} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{project.name}</h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {project.system_prompt ? "Custom instructions active" : "Default instructions"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={openSettings} className="gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </Button>
        </header>

        {/* Workspace */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT: Chat list */}
          <div className="w-56 shrink-0 border-r border-border flex flex-col bg-sidebar/50 hidden md:flex">
            <div className="p-3 border-b border-border">
              <Button variant="outline" size="sm" onClick={handleNewChat} className="w-full gap-2 text-xs">
                <Plus className="h-3.5 w-3.5" />
                New Chat
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {chats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChatId(chat.id)}
                    className={`flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                      activeChatId === chat.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                ))}
                {chats.length === 0 && !chatsLoading && (
                  <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                    No chats yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* CENTER: Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            {!activeChatId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground mb-1">Start a conversation</h2>
                <p className="text-sm text-muted-foreground mb-4">Create a new chat to begin working with Duncan in this project.</p>
                <Button onClick={handleNewChat} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
              </div>
            ) : (
              <>
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="max-w-3xl mx-auto space-y-4">
                    {msgsLoading && (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                        {msg.role === "assistant" && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg overflow-hidden border border-primary/20">
                            <img src={duncanAvatar} alt="Duncan" className="h-full w-full object-cover object-[50%_30%] scale-150" />
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border text-foreground"
                        }`}>
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {sending && (
                      <div className="flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg overflow-hidden border border-primary/20">
                          <img src={duncanAvatar} alt="Duncan" className="h-full w-full object-cover object-[50%_30%] scale-150" />
                        </div>
                        <div className="rounded-xl bg-card border border-border px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Selected files chips above input */}
                {selectedFiles.length > 0 && (
                  <div className="px-4 py-2 border-t border-border bg-primary/5">
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-center gap-1.5 text-xs text-primary mb-1">
                        <Sparkles className="h-3 w-3" />
                        <span className="font-medium">Context files:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedFiles.map(f => (
                          <span
                            key={f.id}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                          >
                            <FileText className="h-3 w-3" />
                            <span className="max-w-[120px] truncate">{f.file_name}</span>
                            <button
                              onClick={() => setSelectedFileIds(prev => prev.filter(id => id !== f.id))}
                              className="ml-0.5 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="border-t border-border px-4 py-3">
                  <div className="max-w-3xl mx-auto flex items-end gap-3 rounded-xl border border-border bg-card px-4 py-3 focus-within:border-primary/40 transition-all">
                    <textarea
                      ref={textareaRef}
                      placeholder="Message Duncan..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      disabled={sending}
                      rows={1}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 resize-none overflow-y-auto"
                      style={{ maxHeight: 160 }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Files */}
          <div className="w-64 shrink-0 border-l border-border flex flex-col bg-sidebar/50 hidden lg:flex">
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-foreground">Files</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="h-7 px-2 gap-1 text-[10px]"
                >
                  {isUploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {isUploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.yaml,.yml"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {files.length === 0 ? (
                  <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                    No files uploaded yet
                  </p>
                ) : (
                  files.map(file => {
                    const extracting = isExtracting(file.id);
                    return (
                      <div key={file.id} className="flex items-start gap-2 rounded-md p-2 hover:bg-secondary/60 transition-colors">
                        <button
                          onClick={() => toggleFileSelection(file.id)}
                          className="shrink-0 mt-0.5"
                          disabled={!file.extracted_text}
                          title={
                            !file.extracted_text
                              ? "Extract text first"
                              : selectedFileIds.includes(file.id) ? "Deselect" : "Select for context"
                          }
                        >
                          {selectedFileIds.includes(file.id) ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className={`h-4 w-4 ${file.extracted_text ? "text-muted-foreground" : "text-muted-foreground/30"}`} />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground truncate">{file.file_name}</p>
                          {extracting ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Extracting...
                            </span>
                          ) : file.extracted_text ? (
                            <span className="text-[10px] text-emerald-500 dark:text-emerald-400">✓ Text extracted</span>
                          ) : (
                            <button
                              onClick={() => extractText(file.id)}
                              className="text-[10px] text-primary hover:underline"
                            >
                              Extract text
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Project Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">System Instructions</label>
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Custom instructions for AI behavior in this project..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={saveSettings} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
