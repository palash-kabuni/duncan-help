import { motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { useState } from "react";

const CommandBar = () => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

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
        placeholder="Ask Norman anything… or type a command"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
      />
      <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
    </motion.div>
  );
};

export default CommandBar;
