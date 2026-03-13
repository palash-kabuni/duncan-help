import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, FileText, MessageSquare, Calendar, FolderOpen,
  CheckCircle2, AlertCircle, ArrowRight, X, Plug, Shield,
  Clock, Database, Zap, Loader2, Lock, ExternalLink,
  GitBranch, Receipt
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useAzureBlobStorage } from "@/hooks/useAzureBlobStorage";
import BasecampBrowser from "@/components/BasecampBrowser";
import {
  useUserIntegrations,
  useConnectIntegration,
  useDisconnectIntegration,
  type UserIntegration,
} from "@/hooks/useUserIntegrations";
import {
  useCompanyIntegrations,
  useUpdateCompanyIntegration,
  type CompanyIntegration,
} from "@/hooks/useCompanyIntegrations";
import { useIsAdmin } from "@/hooks/useUserRoles";

type IntegrationStatus = "connected" | "pending" | "disconnected";
type IntegrationType = "user" | "company";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
  services: string[];
  setupSteps: string[];
  type: IntegrationType; // "user" = per-user, "company" = shared company-wide
}

const integrations: Integration[] = [
  {
    id: "google-workspace",
    name: "Google Workspace",
    description: "Connect Gmail, Calendar, and Docs for workspace intelligence.",
    icon: Mail,
    category: "Productivity",
    services: ["Gmail", "Google Calendar", "Google Docs"],
    type: "user",
    setupSteps: [
      "Create a Google Cloud project and enable the required APIs (Gmail, Drive, Calendar, Docs)",
      "Configure OAuth consent screen with your domain",
      "Create OAuth 2.0 credentials (Client ID & Secret)",
      "Add the credentials to Duncan's settings",
    ],
  },
  {
    id: "gmail",
    name: "Gmail (Recruitment)",
    description: "Company-wide Gmail connection for CV ingestion. Duncan scans incoming emails for CV attachments matching active job roles.",
    icon: Mail,
    category: "Recruitment",
    services: ["CV Ingestion", "Email Parsing", "Attachment Download"],
    type: "company",
    setupSteps: [
      "Uses the same Google Cloud project as other Google integrations",
      "Ensure the Gmail API is enabled",
      "An admin connects via OAuth to authorize read-only access",
      "Duncan will then scan for CV attachments based on job role titles",
    ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Company-wide Notion workspace. Duncan indexes and reasons over shared databases, pages, and wikis.",
    icon: FileText,
    category: "Knowledge",
    services: ["Databases", "Pages", "Wikis", "Comments"],
    type: "company",
    setupSteps: [
      "Go to notion.so/my-integrations and create a new integration",
      "Copy the Internal Integration Token",
      "Share the Notion pages/databases you want Duncan to access with the integration",
      "An admin adds the token to Duncan's settings",
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Monitor channels, automate responses, and sync conversations into Duncan's knowledge base.",
    icon: MessageSquare,
    category: "Communication",
    services: ["Channels", "Direct Messages", "Threads", "Reactions"],
    type: "user",
    setupSteps: [
      "Create a Slack App at api.slack.com/apps",
      "Add Bot Token Scopes (channels:read, chat:write, etc.)",
      "Install the app to your workspace",
      "Copy the Bot User OAuth Token to Duncan's settings",
    ],
  },
  {
    id: "linear",
    name: "Linear",
    description: "Track issues, projects, and cycles. Duncan can auto-triage and update tickets.",
    icon: Zap,
    category: "Project Management",
    services: ["Issues", "Projects", "Cycles", "Teams"],
    type: "user",
    setupSteps: [
      "Go to Linear Settings → API → Personal API Keys",
      "Create a new API key with the required scopes",
      "Add the API key to Duncan's settings",
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Dedicated calendar sync for scheduling intelligence and meeting automation.",
    icon: Calendar,
    category: "Productivity",
    services: ["Events", "Calendars", "Reminders"],
    type: "user",
    setupSteps: [
      "Uses your Google Workspace credentials",
      "Enable the Calendar API in your Google Cloud project",
      "Duncan will automatically sync upcoming and past events",
    ],
  },
  {
    id: "azure-blob",
    name: "Azure Blob Storage",
    description: "Company-wide document storage. Duncan can search and read files across your Azure Blob Storage to answer questions based on your docs.",
    icon: FolderOpen,
    category: "Knowledge",
    services: ["Documents", "NDAs", "Templates", "File Storage"],
    type: "company",
    setupSteps: [
      "Azure Blob Storage connection string is configured as a backend secret",
      "The storage container 'duncanstorage01' is used for all documents",
      "Documents are organized in folders: documents/, ndas/, templates/",
      "Duncan can search, list, and read file contents automatically",
    ],
  },
  {
    id: "basecamp",
    name: "Basecamp",
    description: "Connect Basecamp to access projects, to-dos, messages, schedules, and more across your team.",
    icon: FolderOpen,
    category: "Project Management",
    services: ["Projects", "To-dos", "Messages", "Schedules"],
    type: "company",
    setupSteps: [
      "Register an app at launchpad.37signals.com",
      "Add the redirect URI provided by Duncan",
      "An admin connects via OAuth to authorize access",
      "Duncan can then fetch projects, to-dos, and messages",
    ],
  },
  {
    id: "azure-devops",
    name: "Azure DevOps",
    description: "Sync work items from Azure Boards. Duncan reasons over project tickets, delivery status, and operational risks.",
    icon: GitBranch,
    category: "Operations",
    services: ["Work Items", "Boards", "Sprints", "Queries"],
    type: "company",
    setupSteps: [
      "Register an app in Azure Portal → App registrations",
      "Add redirect URI: your backend callback URL",
      "Add API permission: Azure DevOps → user_impersonation",
      "An admin connects via OAuth to authorize access",
    ],
  },
  {
    id: "xero",
    name: "Xero",
    description: "Sync invoices, bills, contacts, and financial reports. Duncan cross-references finance with operations data.",
    icon: Receipt,
    category: "Finance",
    services: ["Invoices", "Bills", "Contacts", "Reports"],
    type: "company",
    setupSteps: [
      "Create a Xero app at developer.xero.com",
      "Set redirect URI to your backend callback URL",
      "Add scopes: accounting.transactions, contacts, reports",
      "An admin connects via OAuth to authorize access",
    ],
  },
];

const statusConfig = {
  connected: { label: "Connected", color: "text-norman-success", dot: "bg-norman-success", bg: "bg-norman-success/10 border-norman-success/20" },
  pending: { label: "Pending", color: "text-norman-warning", dot: "bg-norman-warning", bg: "bg-norman-warning/10 border-norman-warning/20" },
  disconnected: { label: "Not connected", color: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/50 border-border" },
};

function getStatus(
  integration: Integration,
  userIntegrations: UserIntegration[],
  companyIntegrations: CompanyIntegration[]
): IntegrationStatus {
  if (integration.type === "company") {
    const ci = companyIntegrations.find((c) => c.integration_id === integration.id);
    if (!ci) return "disconnected";
    return ci.status as IntegrationStatus;
  }
  const ui = userIntegrations.find((u) => u.integration_id === integration.id);
  if (!ui) return "disconnected";
  return ui.status as IntegrationStatus;
}

function getIntegrationData(
  integration: Integration,
  userIntegrations: UserIntegration[],
  companyIntegrations: CompanyIntegration[]
) {
  if (integration.type === "company") {
    return companyIntegrations.find((c) => c.integration_id === integration.id);
  }
  return userIntegrations.find((u) => u.integration_id === integration.id);
}

const Integrations = () => {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: userIntegrations = [], isLoading: userLoading } = useUserIntegrations();
  const { data: companyIntegrations = [], isLoading: companyLoading } = useCompanyIntegrations();
  const { isAdmin } = useIsAdmin();
  const { isConnected: isCalendarConnected, checkConnection: checkCalendarConnection } = useGoogleCalendar();
  const [isAzureBlobConnected, setIsAzureBlobConnected] = useState<boolean | null>(null);
  const [isBasecampConnected, setIsBasecampConnected] = useState<boolean | null>(null);
  const [isGmailConnected, setIsGmailConnected] = useState<boolean | null>(null);
  const [isAzureDevOpsConnected, setIsAzureDevOpsConnected] = useState<boolean | null>(null);
  const [isXeroConnected, setIsXeroConnected] = useState<boolean | null>(null);
  const checkAzureBlobConnection = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("company_integrations").select("status").eq("integration_id", "azure-blob").maybeSingle();
      setIsAzureBlobConnected(data?.status === "connected");
    } catch {
      setIsAzureBlobConnected(false);
    }
  };

  const checkBasecampConnection = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("basecamp_tokens").select("id").limit(1);
      setIsBasecampConnected(data && data.length > 0);
    } catch {
      setIsBasecampConnected(false);
    }
  };

  const checkGmailConnection = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("company_integrations").select("status").eq("integration_id", "gmail").maybeSingle();
      setIsGmailConnected(data?.status === "connected");
    } catch {
      setIsGmailConnected(false);
    }
  };

  const checkAzureDevOpsConnection = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("company_integrations").select("status").eq("integration_id", "azure-devops").maybeSingle();
      setIsAzureDevOpsConnected(data?.status === "connected");
    } catch {
      setIsAzureDevOpsConnected(false);
    }
  };

  const checkXeroConnection = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("company_integrations").select("status").eq("integration_id", "xero").maybeSingle();
      setIsXeroConnected(data?.status === "connected");
    } catch {
      setIsXeroConnected(false);
    }
  };

  // Handle OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    
    if (success === "google_calendar") {
      toast.success("Google Calendar connected successfully!");
      checkCalendarConnection();
      setSearchParams({});
    } else if (success === "azure_blob") {
      toast.success("Azure Blob Storage connected successfully!");
      checkAzureBlobConnection();
      setSearchParams({});
    } else if (success === "basecamp") {
      toast.success("Basecamp connected successfully!");
      checkBasecampConnection();
      setSearchParams({});
    } else if (success === "azure_devops") {
      toast.success("Azure DevOps connected successfully!");
      checkAzureDevOpsConnection();
      setSearchParams({});
    } else if (success === "xero") {
      toast.success("Xero connected successfully!");
      checkXeroConnection();
      setSearchParams({});
    } else if (searchParams.get("gmail_connected") === "true") {
      toast.success("Gmail connected successfully!");
      checkGmailConnection();
      setSearchParams({});
    } else if (searchParams.get("gmail_error")) {
      const gmailError = searchParams.get("gmail_error");
      const errorMessages: Record<string, string> = {
        no_code: "Gmail OAuth flow was cancelled",
        token_exchange_failed: "Failed to exchange Gmail authorization code",
        storage_failed: "Failed to save Gmail credentials",
        unknown: "An unexpected Gmail error occurred",
      };
      toast.error(errorMessages[gmailError || "unknown"] || `Gmail connection failed: ${gmailError}`);
      setSearchParams({});
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: "OAuth flow was incomplete",
        config_error: "Google credentials not configured",
        invalid_state: "Invalid OAuth state",
        unauthorized: "Authentication failed",
        admin_required: "Admin access required to connect this integration",
        token_exchange_failed: "Failed to exchange authorization code",
        storage_failed: "Failed to save credentials",
        unexpected: "An unexpected error occurred",
      };
      toast.error(errorMessages[error] || `Connection failed: ${error}`);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, checkCalendarConnection]);

  // Check OAuth connections on mount
  useEffect(() => {
    checkCalendarConnection();
    checkAzureBlobConnection();
    checkBasecampConnection();
    checkGmailConnection();
    checkAzureDevOpsConnection();
    checkXeroConnection();
  }, [checkCalendarConnection]);

  const isLoading = userLoading || companyLoading;

  const categories = ["all", ...Array.from(new Set(integrations.map((i) => i.category)))];
  const filtered = filter === "all" ? integrations : integrations.filter((i) => i.category === filter);

  const connectedCount = integrations.filter((i) => getStatus(i, userIntegrations, companyIntegrations) === "connected").length;
  const userDocs = userIntegrations.reduce((sum, u) => sum + (u.documents_ingested ?? 0), 0);
  const companyDocs = companyIntegrations.reduce((sum, c) => sum + (c.documents_ingested ?? 0), 0);
  const totalDocs = userDocs + companyDocs;
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
              Connect your tools so Duncan can ingest, reason, and automate across your stack.
            </p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 mb-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Plug className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Connected</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{connectedCount} <span className="text-sm font-normal text-muted-foreground">/ {integrations.length}</span></p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-norman-info" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Documents Ingested</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalDocs.toLocaleString()}</p>
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

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            /* Integration Grid */
            <div className="grid grid-cols-2 gap-4">
              {filtered.map((integration, i) => {
                const status = getStatus(integration, userIntegrations, companyIntegrations);
                const s = statusConfig[status];
                const integrationData = getIntegrationData(integration, userIntegrations, companyIntegrations);
                const isCompany = integration.type === "company";
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
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{integration.name}</h3>
                            {isCompany && (
                              <span className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                <Lock className="h-2.5 w-2.5" />
                                Company
                              </span>
                            )}
                          </div>
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
                      {integrationData?.last_sync ? (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50">
                          <Clock className="h-3 w-3" />
                          Last sync: {new Date(integrationData.last_sync).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground/30">Not synced yet</span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        {isCompany && !isAdmin ? "View" : "Configure"} <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedIntegration && (
            <IntegrationDetail
              integration={selectedIntegration}
              userIntegrations={userIntegrations}
              companyIntegrations={companyIntegrations}
              isAdmin={isAdmin}
              isCalendarConnected={isCalendarConnected}
              isAzureBlobConnected={isAzureBlobConnected}
              isBasecampConnected={isBasecampConnected}
              isGmailConnected={isGmailConnected}
              isAzureDevOpsConnected={isAzureDevOpsConnected}
              isXeroConnected={isXeroConnected}
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
  userIntegrations,
  companyIntegrations,
  isAdmin,
  isCalendarConnected,
  isAzureBlobConnected,
  isBasecampConnected,
  isGmailConnected,
  isAzureDevOpsConnected,
  isXeroConnected,
  onClose,
}: {
  integration: Integration;
  userIntegrations: UserIntegration[];
  companyIntegrations: CompanyIntegration[];
  isAdmin: boolean;
  isCalendarConnected: boolean | null;
  isAzureBlobConnected: boolean | null;
  isBasecampConnected: boolean | null;
  isGmailConnected: boolean | null;
  isAzureDevOpsConnected: boolean | null;
  isXeroConnected: boolean | null;
  onClose: () => void;
}) => {
  const isGoogleCalendar = integration.id === "google-calendar";
  const isAzureBlob = integration.id === "azure-blob";
  const isBasecamp = integration.id === "basecamp";
  const isGmail = integration.id === "gmail";
  const isAzureDevOps = integration.id === "azure-devops";
  const isXero = integration.id === "xero";
  const isGoogleOAuth = isGoogleCalendar;
  const isOAuthFlow = isGoogleOAuth || isBasecamp || isGmail || isAzureDevOps || isXero;
  
  // Determine status based on integration type
  let status: IntegrationStatus;
  if (isGoogleCalendar) {
    status = isCalendarConnected ? "connected" : "disconnected";
  } else if (isAzureBlob) {
    status = isAzureBlobConnected ? "connected" : "disconnected";
  } else if (isBasecamp) {
    status = isBasecampConnected ? "connected" : "disconnected";
  } else if (isGmail) {
    status = isGmailConnected ? "connected" : "disconnected";
  } else if (isAzureDevOps) {
    status = isAzureDevOpsConnected ? "connected" : "disconnected";
  } else if (isXero) {
    status = isXeroConnected ? "connected" : "disconnected";
  } else {
    status = getStatus(integration, userIntegrations, companyIntegrations);
  }
  
  const integrationData = getIntegrationData(integration, userIntegrations, companyIntegrations);
  const s = statusConfig[status];
  const [apiKey, setApiKey] = useState("");
  const isCompany = integration.type === "company";
  
  // User integration mutations
  const connectMutation = useConnectIntegration();
  const disconnectMutation = useDisconnectIntegration();
  
  // Company integration mutation
  const companyMutation = useUpdateCompanyIntegration();
  
  // Google OAuth hooks
  const { initiateOAuth: initiateCalendarOAuth, disconnect: disconnectCalendar, isLoading: calendarLoading } = useGoogleCalendar();
  const [basecampLoading, setBasecampLoading] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    try {
      if (isCompany) {
        await companyMutation.mutateAsync({ integrationId: integration.id, apiKey });
      } else {
        await connectMutation.mutateAsync({ integrationId: integration.id, apiKey });
      }
      toast.success(`${integration.name} connected successfully!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
    }
  };

  const handleDisconnect = async () => {
    try {
      if (isGoogleCalendar) {
        await disconnectCalendar();
        toast.success("Google Calendar disconnected");
        onClose();
        return;
      }
      if (isCompany) {
        await companyMutation.mutateAsync({ integrationId: integration.id, action: "disconnect" });
      } else {
        await disconnectMutation.mutateAsync(integration.id);
      }
      toast.success(`${integration.name} disconnected`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect");
    }
  };

  const handleGoogleOAuthConnect = async () => {
    try {
      if (isGoogleCalendar) {
        await initiateCalendarOAuth();
      } else if (isBasecamp) {
        setBasecampLoading(true);
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("basecamp-auth");
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No auth URL returned");
        }
        setBasecampLoading(false);
      } else if (isGmail) {
        setGmailLoading(true);
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("gmail-auth");
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No auth URL returned");
        }
        setGmailLoading(false);
      }
    } catch (err: any) {
      setBasecampLoading(false);
      setGmailLoading(false);
      toast.error(err.message || "Failed to start OAuth flow");
    }
  };

  const googleOAuthLoading = isGoogleCalendar ? calendarLoading : (isBasecamp ? basecampLoading : gmailLoading);
  const isPending = isOAuthFlow ? googleOAuthLoading : (isCompany ? companyMutation.isPending : (connectMutation.isPending || disconnectMutation.isPending));
  const canEdit = !isCompany || isAdmin;

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
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{integration.name}</h2>
                  {isCompany && (
                    <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Lock className="h-3 w-3" />
                      Company
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
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

          {/* What Norman Gets */}
          <div className="mb-8">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">What Duncan Gets</h3>
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

          {/* Admin notice for company integrations */}
          {isCompany && !isAdmin && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary">Only admins can configure company integrations</span>
            </div>
          )}

          {/* Action */}
          {status === "disconnected" ? (
            canEdit ? (
              isOAuthFlow ? (
                // OAuth flow (Calendar, Drive, or Basecamp)
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
                    <p className="text-sm text-foreground">
                      {isBasecamp 
                        ? "Click below to authorize Duncan to access your Basecamp projects, to-dos, and messages."
                        : isGmail
                        ? "Click below to sign in with Google and grant Duncan read-only access to your Gmail for CV ingestion."
                        : `Click below to sign in with Google and grant Duncan access to your calendar.`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isGoogleCalendar 
                         ? "Duncan will be able to read your events and create/update/delete events on your behalf."
                         : isGmail
                         ? "Duncan will scan emails for CV attachments matching active job role titles in the subject line."
                         : "Duncan will be able to read projects, to-dos, messages, and schedules from your Basecamp account."}
                    </p>
                  </div>
                  <button
                    onClick={handleGoogleOAuthConnect}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        {isBasecamp ? "Connect with Basecamp" : isGmail ? "Connect Gmail" : "Sign in with Google"}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                // Standard API key flow
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {isCompany ? "Company API Key / Token" : "API Key / Token"}
                    </Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder={`Enter your ${integration.name} API key...`}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="bg-secondary/30 border-border"
                    />
                  </div>
                  <button
                    onClick={handleConnect}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Plug className="h-4 w-4" />
                        Connect {integration.name}
                      </>
                    )}
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-muted bg-muted/30 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Contact an admin to connect this integration</span>
              </div>
            )
          ) : status === "connected" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-norman-success/20 bg-norman-success/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-norman-success" />
                  <span className="text-sm font-medium text-norman-success">Connected & syncing</span>
                </div>
                {integrationData?.last_sync && (
                  <span className="text-[10px] font-mono text-muted-foreground">{new Date(integrationData.last_sync).toLocaleDateString()}</span>
                )}
              </div>
              {isBasecamp && (
                <div className="mt-4">
                  <BasecampBrowser />
                </div>
              )}
              {canEdit && (
                <button
                  onClick={handleDisconnect}
                  disabled={isPending}
                  className="w-full rounded-xl border border-destructive/20 text-destructive py-2.5 text-sm font-medium hover:bg-destructive/5 transition-all disabled:opacity-50"
                >
                  {isPending ? "Disconnecting..." : "Disconnect"}
                </button>
              )}
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
