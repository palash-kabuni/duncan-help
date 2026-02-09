import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Brain, Zap, BarChart3, Sparkles, Trash2, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Sidebar from "@/components/Sidebar";
import { useNormanChat } from "@/hooks/useNormanChat";

type Mode = "general" | "reason" | "automate" | "analyze";

const modes = [
  { id: "general" as Mode, icon: Sparkles, label: "General" },
  { id: "reason" as Mode, icon: Brain, label: "Reason" },
  { id: "automate" as Mode, icon: Zap, label: "Automate" },
  { id: "analyze" as Mode, icon: BarChart3, label: "Analyze" },
];

const PromptEngine = () => {
  const { messages, isLoading, send, clearMessages } = useNormanChat();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("general");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    send(input.trim(), mode);
    setInput("");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1 flex flex-col h-screen">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-border px-8 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Prompt Engine</h2>
            <p className="text-xs text-muted-foreground font-mono">Norman reasoning & automation interface</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode selector */}
            <div className="flex items-center rounded-lg border border-border bg-card p-1 gap-0.5">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    mode === m.id
                      ? "bg-primary/10 text-primary glow-primary-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <m.icon className="h-3 w-3" />
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={clearMessages}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-8 py-6">
          {messages.length === 0 ? (
            <EmptyState mode={mode} onSend={(s) => send(s, mode)} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-8">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="mr-3 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                        <Brain className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl px-5 py-4 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none leading-7 prose-headings:text-foreground prose-headings:mt-6 prose-headings:mb-3 prose-p:text-foreground/90 prose-p:mb-4 prose-p:leading-7 prose-strong:text-foreground prose-code:text-primary prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:my-4 prose-pre:p-4 prose-li:text-foreground/90 prose-li:mb-2 prose-li:leading-7 prose-ul:my-4 prose-ol:my-4 prose-hr:my-6 prose-hr:border-border prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:my-4">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Norman is thinking…
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="relative z-10 border-t border-border px-8 py-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 focus-within:border-primary/40 focus-within:glow-primary-sm transition-all duration-300">
              <input
                type="text"
                placeholder={`Ask Norman to ${mode === "reason" ? "reason through a problem" : mode === "automate" ? "create an automation workflow" : mode === "analyze" ? "analyze data patterns" : "do anything"}…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] font-mono text-muted-foreground/40">
              Mode: {mode.toUpperCase()} · Powered by Norman AI Engine
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};

const EmptyState = ({ mode, onSend }: { mode: Mode; onSend: (s: string) => void }) => {
  const suggestions: Record<Mode, string[]> = {
    general: [
      "Summarize all unread emails from this week",
      "What are the top priorities across all projects?",
      "Draft a weekly status update from Notion data",
    ],
    reason: [
      "Why did our conversion rate drop last quarter?",
      "What's the best approach to reorganize our team structure?",
      "Analyze the trade-offs of migrating to a new CRM",
    ],
    automate: [
      "Auto-file incoming emails to relevant Notion databases",
      "Create a workflow that syncs meeting notes to project tasks",
      "Set up alerts when KPIs deviate from targets",
    ],
    analyze: [
      "Show trends in customer support tickets this month",
      "Compare team productivity across Q3 and Q4",
      "Identify bottlenecks in our sales pipeline",
    ],
  };

  return (
    <div className="mx-auto max-w-2xl flex flex-col items-center justify-center h-full py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 glow-primary mb-6"
      >
        <Brain className="h-8 w-8 text-primary" />
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-xl font-bold text-foreground mb-2"
      >
        Norman Prompt Engine
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-sm text-muted-foreground mb-8 text-center max-w-md"
      >
        Ask Norman to reason, automate, and analyze across your connected tools and data.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid gap-2 w-full max-w-md"
      >
        {suggestions[mode].map((s, i) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className="text-left rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-foreground/80 hover:bg-card hover:border-primary/20 transition-all duration-200"
          >
            <span className="text-primary mr-2">→</span>
            {s}
          </button>
        ))}
      </motion.div>
    </div>
  );
};

export default PromptEngine;
