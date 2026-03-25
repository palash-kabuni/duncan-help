import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Brain, Sparkles, Trash2, Loader2, Download, Copy, Check,
  FileText, Receipt, Users, FolderOpen, BarChart3, Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Sidebar from "@/components/Sidebar";
import WelcomeModal from "@/components/WelcomeModal";
import { useNormanChat } from "@/hooks/useNormanChat";
import { supabase } from "@/integrations/supabase/client";


const quickActions = [
  { icon: FileText, label: "Generate NDA", prompt: "Generate a new NDA" },
  { icon: Receipt, label: "Fetch Invoices", prompt: "Show me all outstanding Xero invoices awaiting payment" },
  { icon: Users, label: "Recruitment Status", prompt: "Show me the current recruitment pipeline status" },
  { icon: FolderOpen, label: "Basecamp Projects", prompt: "List all active Basecamp projects and their status" },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

/* ── Copy button ── */
const CopyButton = ({ content, messageRef }: { content: string; messageRef: React.RefObject<HTMLDivElement> }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      const htmlContent = messageRef.current?.innerHTML || content;
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([htmlContent], { type: "text/html" }),
          "text/plain": new Blob([content], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors" title="Copy response">
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

/* ── Message bubble ── */
const MessageBubble = ({
  msg, downloadingUrl, handleAuthenticatedDownload,
}: {
  msg: { role: "user" | "assistant"; content: string };
  downloadingUrl: string | null;
  handleAuthenticatedDownload: (url: string) => void;
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      {msg.role === "assistant" && (
        <div className="mr-3 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Brain className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-xl px-5 py-4 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
        {msg.role === "assistant" ? (
          <>
            <div ref={contentRef} className="max-w-none leading-7 text-sm [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-border/60 [&_h1]:text-foreground [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-border/60 [&_h2]:text-foreground [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-foreground [&_p]:text-foreground/90 [&_p]:mb-4 [&_p]:leading-7 [&_strong]:text-foreground [&_strong]:font-semibold [&_code]:text-primary [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs [&_pre]:bg-secondary [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:my-5 [&_pre]:p-4 [&_li]:text-foreground/90 [&_li]:mb-2 [&_li]:leading-7 [&_ul]:my-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-4 [&_ol]:pl-5 [&_ol]:list-decimal [&_hr]:my-8 [&_hr]:border-border/60 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:my-5 [&_blockquote]:bg-primary/5 [&_blockquote]:py-2 [&_blockquote]:pr-4 [&_blockquote]:rounded-r-lg [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_table]:rounded-lg [&_table]:overflow-hidden [&_thead]:bg-secondary/60 [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-foreground [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-xs [&_td]:text-foreground/90 [&_tr]:border-b [&_tr]:border-border/30">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                a: ({ href, children }) => {
                  const isDownloadLink = href?.includes("azure-blob-api") && href?.includes("blob_path");
                  if (isDownloadLink && href) {
                    const isDownloading = downloadingUrl === href;
                    return (
                      <button onClick={() => handleAuthenticatedDownload(href)} disabled={isDownloading} className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 underline underline-offset-2 font-medium disabled:opacity-50">
                        {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {children}
                      </button>
                    );
                  }
                  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline underline-offset-2">{children}</a>;
                },
              }}>{msg.content}</ReactMarkdown>
            </div>
            <div className="mt-2 flex justify-end border-t border-border/30 pt-2">
              <CopyButton content={msg.content} messageRef={contentRef} />
            </div>
          </>
        ) : (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        )}
      </div>
    </motion.div>
  );
};

/* ── Main Page ── */
const Index = () => {
  const { messages, isLoading, send, clearMessages } = useNormanChat();
  const [input, setInput] = useState("");
  
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [weather, setWeather] = useState<{ temp: number; description: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`);
          const data = await res.json();
          const code = data.current.weather_code;
          const desc = code === 0 ? "Clear" : code <= 3 ? "Cloudy" : code <= 48 ? "Foggy" : code <= 67 ? "Rainy" : code <= 77 ? "Snowy" : code <= 82 ? "Showers" : code <= 99 ? "Stormy" : "Clear";
          setWeather({ temp: Math.round(data.current.temperature_2m), description: desc });
        } catch { /* silent */ }
      },
      () => {}
    );
  }, []);

  const handleAuthenticatedDownload = useCallback(async (url: string) => {
    try {
      setDownloadingUrl(url);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const response = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || "download";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
      a.remove();
    } catch (err) { console.error("Download error:", err); }
    finally { setDownloadingUrl(null); }
  }, []);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  useEffect(() => { resizeTextarea(); }, [input, resizeTextarea]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return;
    send(input.trim(), "general");
    setInput("");
    requestAnimationFrame(() => { if (textareaRef.current) { textareaRef.current.style.height = "auto"; textareaRef.current.focus(); } });
  }, [input, isLoading, send, mode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleQuickAction = (prompt: string) => {
    send(prompt, mode);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex min-h-screen bg-background">
      <WelcomeModal />
      <Sidebar />
      <main className="ml-64 flex-1 flex flex-col h-screen">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-border px-8 py-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              {getGreeting()}. Duncan is <span className="text-primary glow-text">operational</span>.
              {weather && <span className="ml-2 text-sm font-normal text-muted-foreground">{weather.temp}°C · {weather.description}</span>}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card p-1 gap-0.5">
              {modes.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${mode === m.id ? "bg-primary/10 text-primary glow-primary-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <m.icon className="h-3 w-3" />
                  {m.label}
                </button>
              ))}
            </div>
            {hasMessages && (
              <button onClick={clearMessages} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-8 py-6">
          {!hasMessages ? (
            <div className="mx-auto max-w-3xl flex flex-col items-center justify-center h-full">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 glow-primary mb-6">
                <Brain className="h-7 w-7 text-primary" />
              </motion.div>
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                Ask Duncan anything, or use a quick action below.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {quickActions.map((action) => (
                  <button key={action.label} onClick={() => handleQuickAction(action.prompt)} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-5 text-center hover:bg-card hover:border-primary/20 transition-all duration-200 group">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 group-hover:glow-primary-sm transition-all">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-foreground">{action.label}</span>
                  </button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} downloadingUrl={downloadingUrl} handleAuthenticatedDownload={handleAuthenticatedDownload} />
                ))}
              </AnimatePresence>
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Duncan is thinking…
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Prompt input */}
        <div className="relative z-10 border-t border-border px-8 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-3 rounded-xl border border-border bg-card px-4 py-3 focus-within:border-primary/40 focus-within:glow-primary-sm transition-all duration-300">
              <textarea
                ref={textareaRef}
                placeholder={`Ask Duncan to ${mode === "reason" ? "reason through a problem" : mode === "automate" ? "create an automation" : mode === "analyze" ? "analyze data" : "do anything"}…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={1}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 resize-none overflow-y-auto"
                style={{ maxHeight: 160 }}
              />
              <button type="button" onClick={handleSubmit} disabled={!input.trim() || isLoading} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] font-mono text-muted-foreground/40">
              Mode: {mode.toUpperCase()} · Shift+Enter for new line · Powered by Duncan AI Engine
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
