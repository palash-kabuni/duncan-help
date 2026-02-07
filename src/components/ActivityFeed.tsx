import { motion } from "framer-motion";
import { Brain, Zap, ArrowRight, GitBranch, MessageSquare } from "lucide-react";

const activities = [
  { icon: Zap, text: "Auto-filed 12 emails from inbox to project channels", time: "3m ago", type: "automation" },
  { icon: Brain, text: "Analyzed Q4 report and generated summary in Notion", time: "18m ago", type: "reasoning" },
  { icon: GitBranch, text: "Synced 4 Google Drive folders with workspace", time: "1h ago", type: "sync" },
  { icon: MessageSquare, text: "Drafted 3 follow-up messages from meeting notes", time: "2h ago", type: "automation" },
  { icon: Brain, text: "Detected anomaly in sales pipeline data", time: "4h ago", type: "reasoning" },
];

const typeColors: Record<string, string> = {
  automation: "text-primary bg-primary/10",
  reasoning: "text-norman-info bg-norman-info/10",
  sync: "text-norman-success bg-norman-success/10",
};

const ActivityFeed = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="divide-y divide-border">
        {activities.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.08 }}
            className="flex items-start gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors"
          >
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${typeColors[item.type]}`}>
              <item.icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/90 leading-snug">{item.text}</p>
              <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/50">{item.time}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default ActivityFeed;
