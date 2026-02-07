import { motion } from "framer-motion";
import { Database, Plug, Brain, Zap, Mail, FileText, Calendar, MessageSquare } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import CommandBar from "@/components/CommandBar";
import StatusCard from "@/components/StatusCard";
import IntegrationCard from "@/components/IntegrationCard";
import ActivityFeed from "@/components/ActivityFeed";
import PipelineOverview from "@/components/PipelineOverview";

const Index = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1">
        {/* Top gradient wash */}
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        <div className="relative z-10 px-8 py-8 max-w-6xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2"
          >
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
            <StatusCard icon={Database} label="Documents Indexed" value="12,847" subtext="+234 today" status="success" delay={0.15} />
            <StatusCard icon={Plug} label="Active Integrations" value="4 / 6" subtext="2 pending setup" status="info" delay={0.2} />
            <StatusCard icon={Zap} label="Automations Run" value="847" subtext="This week" status="success" delay={0.25} />
            <StatusCard icon={Brain} label="Reasoning Tasks" value="23" subtext="3 in queue" status="warning" delay={0.3} />
          </div>

          {/* Pipeline */}
          <div className="mb-8">
            <PipelineOverview />
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-5 gap-6">
            {/* Activity */}
            <div className="col-span-3">
              <ActivityFeed />
            </div>

            {/* Integrations */}
            <div className="col-span-2 space-y-3">
              <h3 className="text-sm font-semibold text-foreground mb-3">Integrations</h3>
              <IntegrationCard icon={Mail} name="Google Workspace" description="Gmail, Drive, Calendar" status="connected" lastSync="2m ago" delay={0.35} />
              <IntegrationCard icon={FileText} name="Notion" description="Databases & pages" status="connected" lastSync="5m ago" delay={0.4} />
              <IntegrationCard icon={Calendar} name="Slack" description="Channels & messages" status="pending" delay={0.45} />
              <IntegrationCard icon={MessageSquare} name="Linear" description="Issues & projects" status="disconnected" delay={0.5} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
