import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatusCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext?: string;
  status?: "success" | "warning" | "info" | "neutral";
  delay?: number;
}

const statusColors = {
  success: "bg-norman-success/10 text-norman-success border-norman-success/20",
  warning: "bg-norman-warning/10 text-norman-warning border-norman-warning/20",
  info: "bg-norman-info/10 text-norman-info border-norman-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

const dotColors = {
  success: "bg-norman-success",
  warning: "bg-norman-warning",
  info: "bg-norman-info",
  neutral: "bg-muted-foreground",
};

const StatusCard = ({ icon: Icon, label, value, subtext, status = "neutral", delay = 0 }: StatusCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-colors duration-300"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${statusColors[status]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${dotColors[status]} animate-pulse-glow`} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{status}</span>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        {subtext && <p className="mt-1 text-[10px] font-mono text-muted-foreground/60">{subtext}</p>}
      </div>
    </motion.div>
  );
};

export default StatusCard;
