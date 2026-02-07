import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, FileText, MessageSquare, Calendar, FolderOpen, Users,
  CheckCircle2, AlertCircle, ArrowRight, X, ExternalLink, Plug, Shield,
  Clock, Database, Zap
} from "lucide-react";
import Sidebar from "@/components/Sidebar";

type IntegrationStatus = "connected" | "pending" | "disconnected";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: IntegrationStatus;
  category: string;
  services: string[];
  lastSync?: string;
  documentsIngested?: number;
  setupSteps: string[];
}

const integrations: Integration[] = [
  {
    id: "google-workspace",
    name: "Google Workspace",
    description: "Connect Gmail, Google Drive, Calendar, and Docs for full workspace intelligence.",
    icon: Mail,
    status: "disconnected",
    category: "Productivity",
    services: ["Gmail", "Google Drive", "Google Calendar", "Google Docs"],
    setupSteps: [
      "Create a Google Cloud project and enable the required APIs (Gmail, Drive, Calendar, Docs)",
      "Configure OAuth consent screen with your domain",
      "Create OAuth 2.0 credentials (Client ID & Secret)",
      "Add the credentials to Norman's settings",
    ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Sync databases, pages, and wikis. Norman will index and reason over your Notion workspace.",
    icon: FileText,
    status: "disconnected",
    category: "Knowledge",
    services: ["Databases", "Pages", "Wikis", "Comments"],
    setupSteps: [
      "Go to notion.so/my-integrations and create a new integration",
      "Copy the Internal Integration Token",
      "Share the Notion pages/databases you want Norman to access with the integration",
      "Add the token to Norman's settings",
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Monitor channels, automate responses, and sync conversations into Norman's knowledge base.",
    icon: MessageSquare,
    status: "disconnected",
    category: "Communication",
    services: ["Channels", "Direct Messages", "Threads", "Reactions"],
    setupSteps: [
      "Create a Slack App at api.slack.com/apps",
      "Add Bot Token Scopes (channels:read, chat:write, etc.)",
      "Install the app to your workspace",
      "Copy the Bot User OAuth Token to Norman's settings",
    ],
  },
  {
    id: "linear",
    name: "Linear",
    description: "Track issues, projects, and cycles. Norman can auto-triage and update tickets.",
    icon: Zap,
    status: "disconnected",
    category: "Project Management",
    services: ["Issues", "Projects", "Cycles", "Teams"],
    setupSteps: [
      "Go to Linear Settings → API → Personal API Keys",
      "Create a new API key with the required scopes",
      "Add the API key to Norman's settings",
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Dedicated calendar sync for scheduling intelligence and meeting automation.",
    icon: Calendar,
    status: "disconnected",
    category: "Productivity",
    services: ["Events", "Calendars", "Reminders"],
    setupSteps: [
      "Uses your Google Workspace credentials",
      "Enable the Calendar API in your Google Cloud project",
      "Norman will automatically sync upcoming and past events",
    ],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Deep document indexing across all your Drive files for comprehensive search and reasoning.",
    icon: FolderOpen,
    status: "disconnected",
    category: "Knowledge",
    services: ["Documents", "Spreadsheets", "Presentations", "Folders"],
    setupSteps: [
      "Uses your Google Workspace credentials",
      "Enable the Drive API in your Google Cloud project",
      "Select which folders Norman should index",
    ],
  },
];

const statusConfig = {
  connected: { label: "Connected", color: "text-norman-success", dot: "bg-norman-success", bg: "bg-norman-success/10 border-norman-success/20" },
  pending: { label: "Pending", color: "text-norman-warning", dot: "bg-norman-warning", bg: "bg-norman-warning/10 border-norman-warning/20" },
  disconnected: { label: "Not connected", color: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/50 border-border" },
};

const Integrations = () => {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const categories = ["all", ...Array.from(new Set(integrations.map((i) => i.category)))];
  const filtered = filter === "all" ? integrations : integrations.filter((i) => i.category === filter);

  const stats = {
    connected: integrations.filter((i) => i.status === "connected").length,
    total: integrations.length,
    documents: integrations.reduce((sum, i) => sum + (i.documentsIngested ?? 0), 0),
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        <div className="relative z-10 px-8 py-8 max-w-6xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Integrations</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your tools so Norman can ingest, reason, and automate across your stack.
            </p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 mb-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Plug className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Connected</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.connected} <span className="text-sm font-normal text-muted-foreground">/ {stats.total}</span></p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-norman-info" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Documents Ingested</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.documents.toLocaleString()}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-norman-success" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Security</span>
              </div>
              <p className="text-sm font-medium text-foreground">All keys encrypted</p>
              <p className="text-[10px] font-mono text-muted-foreground/50">AES-256 · At rest</p>
            </motion.div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  filter === cat
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>

          {/* Integration Grid */}
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((integration, i) => {
              const s = statusConfig[integration.status];
              return (
                <motion.div
                  key={integration.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => setSelectedIntegration(integration)}
                  className="group cursor-pointer rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <integration.icon className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{integration.name}</h3>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{integration.category}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${s.bg}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      <span className={`text-[10px] font-medium ${s.color}`}>{s.label}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{integration.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {integration.services.map((service) => (
                      <span key={service} className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        {service}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    {integration.lastSync ? (
                      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50">
                        <Clock className="h-3 w-3" />
                        Last sync: {integration.lastSync}
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground/30">Not synced yet</span>
                    )}
                    <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Configure <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedIntegration && (
            <IntegrationDetail
              integration={selectedIntegration}
              onClose={() => setSelectedIntegration(null)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const IntegrationDetail = ({
  integration,
  onClose,
}: {
  integration: Integration;
  onClose: () => void;
}) => {
  const s = statusConfig[integration.status];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg border-l border-border bg-card overflow-y-auto"
      >
        <div className="px-6 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <integration.icon className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{integration.name}</h2>
                <div className={`flex items-center gap-1.5 mt-0.5`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{integration.description}</p>

          {/* Services */}
          <div className="mb-6">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Services Included</h3>
            <div className="grid grid-cols-2 gap-2">
              {integration.services.map((service) => (
                <div key={service} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-foreground">{service}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Setup Steps */}
          <div className="mb-6">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">Setup Guide</h3>
            <div className="space-y-3">
              {integration.setupSteps.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Data Norman will access */}
          <div className="mb-8">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">What Norman Gets</h3>
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-foreground">Full content indexing for reasoning</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-norman-warning" />
                <span className="text-xs text-foreground">Real-time sync for automation triggers</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-norman-success" />
                <span className="text-xs text-foreground">Scoped access — only what you share</span>
              </div>
            </div>
          </div>

          {/* Action */}
          {integration.status === "disconnected" ? (
            <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 transition-all">
              <Plug className="h-4 w-4" />
              Connect {integration.name}
              <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </button>
          ) : integration.status === "connected" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-norman-success/20 bg-norman-success/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-norman-success" />
                  <span className="text-sm font-medium text-norman-success">Connected & syncing</span>
                </div>
                {integration.lastSync && (
                  <span className="text-[10px] font-mono text-muted-foreground">{integration.lastSync}</span>
                )}
              </div>
              <button className="w-full rounded-xl border border-destructive/20 text-destructive py-2.5 text-sm font-medium hover:bg-destructive/5 transition-all">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-norman-warning/20 bg-norman-warning/5 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-norman-warning" />
              <span className="text-sm text-norman-warning">Awaiting configuration</span>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default Integrations;
