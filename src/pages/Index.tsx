import { motion } from "framer-motion";
import { Database, Plug, Brain, Zap, Mail, FileText, Calendar, MessageSquare, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import CommandBar from "@/components/CommandBar";
import StatusCard from "@/components/StatusCard";
import IntegrationCard from "@/components/IntegrationCard";
import ActivityFeed from "@/components/ActivityFeed";
import PipelineOverview from "@/components/PipelineOverview";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";

const integrationMeta: Record<string, { icon: any; name: string; description: string }> = {
  "google-workspace": { icon: Mail, name: "Google Workspace", description: "Gmail, Drive, Calendar" },
  "notion": { icon: FileText, name: "Notion", description: "Databases & pages" },
  "slack": { icon: MessageSquare, name: "Slack", description: "Channels & messages" },
  "linear": { icon: Zap, name: "Linear", description: "Issues & projects" },
  "google-calendar": { icon: Calendar, name: "Google Calendar", description: "Events & scheduling" },
  "google-drive": { icon: FolderOpen, name: "Google Drive", description: "Documents & files" },
};

const allIntegrationIds = ["google-workspace", "notion", "slack", "linear", "google-calendar", "google-drive"];

const Index = () => {
  const { data: userIntegrations = [] } = useUserIntegrations();
  const navigate = useNavigate();

  const connectedCount = userIntegrations.filter(u => u.status === "connected").length;
  const totalDocs = userIntegrations.reduce((sum, u) => sum + (u.documents_ingested ?? 0), 0);
  const pendingCount = allIntegrationIds.length - connectedCount;

  const getStatus = (id: string): "connected" | "pending" | "disconnected" => {
    const ui = userIntegrations.find(u => u.integration_id === id);
    if (!ui) return "disconnected";
    return ui.status as any;
  };

  const getLastSync = (id: string): string | undefined => {
    const ui = userIntegrations.find(u => u.integration_id === id);
    if (!ui?.last_sync) return undefined;
    const diff = Date.now() - new Date(ui.last_sync).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        <div className="relative z-10 px-8 py-8 max-w-6xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-2">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Good morning. Norman is <span className="text-primary glow-text">operational</span>.
            </h2>
          </motion.div>

          {/* Command Bar */}
          <div className="mt-6 mb-8">
            <CommandBar />
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatusCard icon={Database} label="Documents Indexed" value={totalDocs.toLocaleString()} subtext={totalDocs > 0 ? "Across integrations" : "Connect tools to start"} status={totalDocs > 0 ? "success" : "neutral"} delay={0.15} />
            <StatusCard icon={Plug} label="Active Integrations" value={`${connectedCount} / ${allIntegrationIds.length}`} subtext={pendingCount > 0 ? `${pendingCount} pending setup` : "All connected"} status={connectedCount > 0 ? "info" : "neutral"} delay={0.2} />
            <StatusCard icon={Zap} label="Automations Run" value="0" subtext="Connect tools to start" status="neutral" delay={0.25} />
            <StatusCard icon={Brain} label="Reasoning Tasks" value="0" subtext="Use Prompt Engine" status="neutral" delay={0.3} />
          </div>

          {/* Pipeline */}
          <div className="mb-8">
            <PipelineOverview />
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-5 gap-6">
            <div className="col-span-3">
              <ActivityFeed />
            </div>

            {/* Integrations - real data */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Integrations</h3>
                <button onClick={() => navigate("/integrations")} className="text-xs text-primary hover:underline">Manage</button>
              </div>
              {allIntegrationIds.slice(0, 4).map((id, i) => {
                const meta = integrationMeta[id];
                const status = getStatus(id);
                const lastSync = getLastSync(id);
                return (
                  <div key={id} onClick={() => navigate("/integrations")} className="cursor-pointer">
                    <IntegrationCard
                      icon={meta.icon}
                      name={meta.name}
                      description={meta.description}
                      status={status}
                      lastSync={lastSync}
                      delay={0.35 + i * 0.05}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
