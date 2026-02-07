import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface IntegrationCardProps {
  icon: LucideIcon;
  name: string;
  description: string;
  status: "connected" | "pending" | "disconnected";
  lastSync?: string;
  delay?: number;
}

const statusMap = {
  connected: { label: "Connected", dot: "bg-norman-success", text: "text-norman-success" },
  pending: { label: "Pending", dot: "bg-norman-warning", text: "text-norman-warning" },
  disconnected: { label: "Not connected", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

const IntegrationCard = ({ icon: Icon, name, description, status, lastSync, delay = 0 }: IntegrationCardProps) => {
  const s = statusMap[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
            <span className={`text-[11px] font-medium ${s.text}`}>{s.label}</span>
          </div>
          {lastSync && (
            <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{lastSync}</p>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </div>
    </motion.div>
  );
};

export default IntegrationCard;
