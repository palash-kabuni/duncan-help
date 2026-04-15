import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  system_prompt: string | null;
  created_at: string;
}

export interface ProjectChat {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  storage_path: string;
  extracted_text: string | null;
  created_at: string;
}

export function useProjects() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: "Failed to load projects", variant: "destructive" });
    } else {
      setProjects((data as any[]) || []);
    }
    setLoading(false);
  }, [session, toast]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const createProject = useCallback(async (name: string, systemPrompt?: string) => {
    if (!session) return null;
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: session.user.id, name, system_prompt: systemPrompt || null })
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: "Failed to create project", variant: "destructive" });
      return null;
    }
    setProjects(prev => [data as any, ...prev]);
    return data as Project;
  }, [session, toast]);

  const updateProject = useCallback(async (id: string, updates: { name?: string; system_prompt?: string | null }) => {
    const { error } = await supabase.from("projects").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to update project", variant: "destructive" });
      return false;
    }
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    return true;
  }, [toast]);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
      return false;
    }
    setProjects(prev => prev.filter(p => p.id !== id));
    return true;
  }, [toast]);

  return { projects, loading, fetchProjects, createProject, updateProject, deleteProject };
}

export function useProjectChats(projectId: string | null) {
  const { toast } = useToast();
  const [chats, setChats] = useState<ProjectChat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("project_chats")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: "Failed to load chats", variant: "destructive" });
    } else {
      setChats((data as any[]) || []);
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  const createChat = useCallback(async (title?: string) => {
    if (!projectId) return null;
    const { data, error } = await supabase
      .from("project_chats")
      .insert({ project_id: projectId, title: title || "New Chat" })
      .select()
      .single();
    if (error) {
      toast({ title: "Error", description: "Failed to create chat", variant: "destructive" });
      return null;
    }
    setChats(prev => [data as any, ...prev]);
    return data as ProjectChat;
  }, [projectId, toast]);

  const updateChatTitle = useCallback(async (chatId: string, title: string) => {
    const { error } = await supabase
      .from("project_chats")
      .update({ title })
      .eq("id", chatId);
    if (!error) {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c));
    }
  }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    const { error } = await supabase
      .from("project_chats")
      .delete()
      .eq("id", chatId);
    if (!error) {
      setChats(prev => prev.filter(c => c.id !== chatId));
    }
    return !error;
  }, []);

  return { chats, loading, fetchChats, createChat, updateChatTitle, deleteChat };
}

export function useProjectChat(chatId: string | null) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!chatId) { setMessages([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Error", description: "Failed to load messages", variant: "destructive" });
    } else {
      setMessages((data as any[]) || []);
    }
    setLoading(false);
  }, [chatId, toast]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const sendMessage = useCallback(async (message: string, overrideChatId?: string) => {
    const targetChatId = overrideChatId || chatId;
    if (!targetChatId || !message.trim()) return null;
    setSending(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      chat_id: targetChatId,
      role: "user",
      content: message.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("chat-with-project-context", {
        body: { chat_id: targetChatId, message: message.trim() },
      });

      if (error) throw error;

      // Refetch messages from DB to sync real IDs
      const { data: dbMessages } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", targetChatId)
        .order("created_at", { ascending: true });

      if (dbMessages) {
        setMessages(dbMessages as any[]);
      }

      return data.reply;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to get response", variant: "destructive" });
      // Remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      return null;
    } finally {
      setSending(false);
    }
  }, [chatId, toast]);

  return { messages, loading, sending, sendMessage, fetchMessages };
}

export function useProjectFiles(projectId: string | null) {
  const { toast } = useToast();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [extractingFiles, setExtractingFiles] = useState<Set<string>>(new Set());

  const fetchFiles = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: "Failed to load files", variant: "destructive" });
    } else {
      setFiles((data as any[]) || []);
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const uploadFile = useCallback(async (file: File) => {
    if (!projectId) return null;
    const tempId = `uploading-${file.name}`;
    setUploadingFiles(prev => new Set(prev).add(tempId));

    const formData = new FormData();
    formData.append("project_id", projectId);
    formData.append("file", file);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-project-file`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      const fileRecord = await response.json();
      setFiles(prev => [fileRecord, ...prev]);
      toast({ title: "File uploaded", description: `${file.name} — indexing...` });

      // Auto-trigger indexing after upload
      try {
        setExtractingFiles(prev => new Set(prev).add(fileRecord.id));
        const { data: extractData, error: extractError } = await supabase.functions.invoke("extract-file-text", {
          body: { file_id: fileRecord.id },
        });
        if (extractError) {
          console.error("Auto-index failed:", extractError);
          toast({ title: "Indexing failed", description: "You can retry from the Files panel.", variant: "destructive" });
        } else {
          toast({ title: "File indexed", description: `${extractData.chunks_created || 0} chunks created` });
          await fetchFiles();
        }
      } catch (indexErr) {
        console.error("Auto-index error:", indexErr);
      } finally {
        setExtractingFiles(prev => {
          const next = new Set(prev);
          next.delete(fileRecord.id);
          return next;
        });
      }

      return fileRecord as ProjectFile;
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }
  }, [projectId, toast]);

  const extractText = useCallback(async (fileId: string) => {
    setExtractingFiles(prev => new Set(prev).add(fileId));
    try {
      const { data, error } = await supabase.functions.invoke("extract-file-text", {
        body: { file_id: fileId },
      });
      if (error) throw error;

      await fetchFiles();
      toast({ title: "File indexed", description: `${data.chunks_created || 0} chunks created (${data.text_length} chars)` });
      return true;
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setExtractingFiles(prev => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  }, [toast, fetchFiles]);

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const { error } = await supabase.functions.invoke("delete-project-file", {
        body: { file_id: fileId },
      });
      if (error) throw error;
      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast({ title: "File deleted" });
      return true;
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      return false;
    }
  }, [toast]);

  return {
    files, loading, fetchFiles, uploadFile, extractText, deleteFile,
    isUploading: uploadingFiles.size > 0,
    isExtracting: (fileId: string) => extractingFiles.has(fileId),
  };
}
