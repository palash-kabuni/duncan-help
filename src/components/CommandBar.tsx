import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const CommandBar = () => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate("/prompt-engine", { state: { initialMessage: trimmed } });
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={`relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${
        isFocused
          ? "border-primary/40 bg-card glow-primary-sm"
          : "border-border bg-card/60"
      }`}
    >
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <input
        type="text"
        placeholder="Ask Duncan anything… or type a command"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
      />
      {query.trim() ? (
        <button
          onMouseDown={(e) => { e.preventDefault(); handleSubmit(); }}
          className="shrink-0 rounded-lg bg-primary/10 p-1.5 text-primary hover:bg-primary/20 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      )}
    </motion.div>
  );
};

export default CommandBar;
