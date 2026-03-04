import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, Plug, Mail, FileText, Calendar, MessageSquare, FolderOpen, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import CommandBar from "@/components/CommandBar";
import StatusCard from "@/components/StatusCard";
import IntegrationCard from "@/components/IntegrationCard";
import WelcomeModal from "@/components/WelcomeModal";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";

const integrationMeta: Record<string, { icon: any; name: string; description: string }> = {
  "google-workspace": { icon: Mail, name: "Google Workspace", description: "Gmail, Calendar" },
  "notion": { icon: FileText, name: "Notion", description: "Databases & pages" },
  "slack": { icon: MessageSquare, name: "Slack", description: "Channels & messages" },
  "linear": { icon: Zap, name: "Linear", description: "Issues & projects" },
  "google-calendar": { icon: Calendar, name: "Google Calendar", description: "Events & scheduling" },
  "azure-blob": { icon: FolderOpen, name: "Azure Blob Storage", description: "Documents & files" },
};

const allIntegrationIds = ["google-workspace", "notion", "slack", "linear", "google-calendar", "azure-blob"];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Index = () => {
  const { data: userIntegrations = [] } = useUserIntegrations();
  const navigate = useNavigate();
  const [weather, setWeather] = useState<{ temp: number; description: string } | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
          );
          const data = await res.json();
          const code = data.current.weather_code;
          const desc =
            code === 0 ? "Clear" :
            code <= 3 ? "Cloudy" :
            code <= 48 ? "Foggy" :
            code <= 67 ? "Rainy" :
            code <= 77 ? "Snowy" :
            code <= 82 ? "Showers" :
            code <= 99 ? "Stormy" : "Clear";
          setWeather({ temp: Math.round(data.current.temperature_2m), description: desc });
        } catch { /* silently fail */ }
      },
      () => { /* location denied, no weather */ }
    );
  }, []);

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
      <WelcomeModal />
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
              {getGreeting()}. Duncan is <span className="text-primary glow-text">operational</span>.
              {weather && (
                <span className="ml-3 text-base font-normal text-muted-foreground">
                  {weather.temp}°C · {weather.description}
                </span>
              )}
            </h2>
          </motion.div>

          {/* Command Bar */}
          <div className="mt-6 mb-8">
            <CommandBar />
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <StatusCard icon={Database} label="Documents Indexed" value={totalDocs.toLocaleString()} subtext={totalDocs > 0 ? "Across integrations" : "Connect tools to start"} status={totalDocs > 0 ? "success" : "neutral"} delay={0.15} />
            <StatusCard icon={Plug} label="Active Integrations" value={`${connectedCount} / ${allIntegrationIds.length}`} subtext={pendingCount > 0 ? `${pendingCount} pending setup` : "All connected"} status={connectedCount > 0 ? "info" : "neutral"} delay={0.2} />
          </div>

          {/* Integrations */}
          <div className="space-y-3">
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
      </main>
    </div>
  );
};

export default Index;
