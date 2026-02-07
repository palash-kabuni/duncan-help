import { motion } from "framer-motion";

const stages = [
  { label: "Ingest", count: 1248, status: "active" as const },
  { label: "Parse", count: 1241, status: "active" as const },
  { label: "Embed", count: 1220, status: "active" as const },
  { label: "Index", count: 1220, status: "active" as const },
  { label: "Ready", count: 1198, status: "complete" as const },
];

const PipelineOverview = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">Data Pipeline</h3>
      <div className="flex items-center gap-2">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-2 flex-1">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{stage.label}</span>
                <span className="text-[10px] font-mono text-primary">{stage.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.6 + i * 0.1, duration: 0.6 }}
                  className={`h-full rounded-full ${
                    stage.status === "complete" ? "bg-norman-success" : "bg-primary"
                  }`}
                />
              </div>
            </div>
            {i < stages.length - 1 && (
              <div className="text-muted-foreground/30 text-xs mt-3">→</div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] font-mono text-muted-foreground/50">
        Processing 50 documents · ETA 4m · 96% success rate
      </p>
    </motion.div>
  );
};

export default PipelineOverview;
