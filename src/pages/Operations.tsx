import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  GitBranch, Receipt, AlertTriangle, CheckCircle2,
  Clock, RefreshCw, Loader2, Activity, TrendingUp,
  ArrowUpRight, ArrowDownRight, Filter, ChevronLeft, ChevronRight, Search
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function useWorkItems() {
  return useQuery({
    queryKey: ["azure-work-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("azure_work_items")
        .select("*")
        .order("changed_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}

function useXeroInvoices() {
  return useQuery({
    queryKey: ["xero-invoices"],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("xero_invoices")
        .select("*", { count: "exact" })
        .order("date", { ascending: false });
      if (error) throw error;
      return { invoices: data || [], total: count || 0 };
    },
  });
}

function useXeroContacts() {
  return useQuery({
    queryKey: ["xero-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("xero_contacts")
        .select("*")
        .order("name", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}

function useSyncLogs() {
  return useQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

const stateColors: Record<string, string> = {
  "New": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Active": "bg-primary/10 text-primary border-primary/20",
  "Resolved": "bg-norman-success/10 text-norman-success border-norman-success/20",
  "Closed": "bg-muted text-muted-foreground border-border",
  "Removed": "bg-destructive/10 text-destructive border-destructive/20",
};

const invoiceStatusColors: Record<string, string> = {
  "AUTHORISED": "bg-norman-success/10 text-norman-success border-norman-success/20",
  "PAID": "bg-norman-success/10 text-norman-success border-norman-success/20",
  "DRAFT": "bg-muted text-muted-foreground border-border",
  "SUBMITTED": "bg-norman-warning/10 text-norman-warning border-norman-warning/20",
  "OVERDUE": "bg-destructive/10 text-destructive border-destructive/20",
  "VOIDED": "bg-muted text-muted-foreground border-border",
};

const Operations = () => {
  const { data: workItems = [], isLoading: wiLoading } = useWorkItems();
  const { data: invoiceData, isLoading: invLoading } = useXeroInvoices();
  const invoices = invoiceData?.invoices || [];
  const { data: contacts = [], isLoading: conLoading } = useXeroContacts();
  const { data: syncLogs = [], isLoading: slLoading } = useSyncLogs();
  const [syncing, setSyncing] = useState<string | null>(null);

  // Invoice filters
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("all");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoicePage, setInvoicePage] = useState(0);
  const INVOICES_PER_PAGE = 25;

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    if (invoiceStatusFilter !== "all") {
      if (invoiceStatusFilter === "OVERDUE") {
        filtered = filtered.filter((i: any) => {
          if (!i.due_date || i.status === "PAID" || i.status === "VOIDED") return false;
          return new Date(i.due_date) < new Date();
        });
      } else {
        filtered = filtered.filter((i: any) => i.status === invoiceStatusFilter);
      }
    }
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase();
      filtered = filtered.filter((i: any) =>
        (i.invoice_number || "").toLowerCase().includes(q) ||
        (i.contact_name || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [invoices, invoiceStatusFilter, invoiceSearch]);

  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE));
  const paginatedInvoices = filteredInvoices.slice(invoicePage * INVOICES_PER_PAGE, (invoicePage + 1) * INVOICES_PER_PAGE);

  const handleSync = async (type: "azure" | "xero") => {
    setSyncing(type);
    try {
      const fn = type === "azure" ? "sync-azure-work-items" : "sync-xero-data";
      const { error } = await supabase.functions.invoke(fn);
      if (error) throw error;
      toast.success(`${type === "azure" ? "Azure DevOps" : "Xero"} sync started`);
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  // Stats
  const activeItems = workItems.filter((w: any) => w.state === "Active" || w.state === "New").length;
  const blockedItems = workItems.filter((w: any) => w.tags?.toLowerCase().includes("blocked")).length;
  const overdueInvoices = invoices.filter((i: any) => {
    if (!i.due_date || i.status === "PAID" || i.status === "VOIDED") return false;
    return new Date(i.due_date) < new Date();
  });
  const totalOutstanding = invoices.reduce((sum: number, i: any) => sum + Number(i.amount_due || 0), 0);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        <div className="relative z-10 px-8 py-8 max-w-7xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Operations Hub</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Cross-system view of Azure DevOps work items and Xero financial data.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync("azure")}
                  disabled={syncing === "azure"}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {syncing === "azure" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sync DevOps
                </button>
                <button
                  onClick={() => handleSync("xero")}
                  disabled={syncing === "xero"}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {syncing === "xero" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sync Xero
                </button>
              </div>
            </div>
          </motion.div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Active Items</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{activeItems}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-norman-warning" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Blocked</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{blockedItems}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-destructive" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Overdue Invoices</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{overdueInvoices.length}</p>
            </motion.div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="work-items" className="space-y-4">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="work-items" className="gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Work Items
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Invoices
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Contacts
              </TabsTrigger>
              <TabsTrigger value="sync-logs" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Sync Logs
              </TabsTrigger>
            </TabsList>

            {/* Work Items */}
            <TabsContent value="work-items">
              {wiLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : workItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GitBranch className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No work items synced yet. Connect Azure DevOps and run a sync.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">ID</th>
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Title</th>
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">State</th>
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Assigned To</th>
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Project</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workItems.map((item: any) => (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{item.external_id}</td>
                          <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">{item.title}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={stateColors[item.state] || ""}>{item.state}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.work_item_type}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.assigned_to || "—"}</td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.project_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Invoices */}
            <TabsContent value="invoices">
              {invLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No invoices synced yet. Connect Xero and run a sync.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Filters */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search invoice # or contact..."
                        value={invoiceSearch}
                        onChange={(e) => { setInvoiceSearch(e.target.value); setInvoicePage(0); }}
                        className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {["all", "AUTHORISED", "PAID", "DRAFT", "OVERDUE", "VOIDED"].map((status) => (
                        <button
                          key={status}
                          onClick={() => { setInvoiceStatusFilter(status); setInvoicePage(0); }}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors border ${
                            invoiceStatusFilter === status
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-card text-muted-foreground border-border hover:bg-secondary"
                          }`}
                        >
                          {status === "all" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Table */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Invoice #</th>
                          <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Contact</th>
                          <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Date</th>
                          <th className="text-right px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Total</th>
                          <th className="text-right px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Due</th>
                          <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInvoices.length === 0 ? (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No invoices match your filters.</td></tr>
                        ) : paginatedInvoices.map((inv: any) => {
                          const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "PAID" && inv.status !== "VOIDED";
                          return (
                            <tr key={inv.id} className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${isOverdue ? "bg-destructive/5" : ""}`}>
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.invoice_number || "—"}</td>
                              <td className="px-4 py-3 font-medium text-foreground">{inv.contact_name}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className={invoiceStatusColors[isOverdue ? "OVERDUE" : inv.status] || ""}>
                                  {isOverdue ? "OVERDUE" : inv.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{inv.type === "ACCREC" ? "Receivable" : "Payable"}</td>
                              <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{inv.date || "—"}</td>
                              <td className="px-4 py-3 text-right font-mono text-foreground">£{Number(inv.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3 text-right font-mono text-foreground">£{Number(inv.amount_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{inv.due_date || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalInvoicePages > 1 && (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-muted-foreground">
                        Page {invoicePage + 1} of {totalInvoicePages}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setInvoicePage(Math.max(0, invoicePage - 1))}
                          disabled={invoicePage === 0}
                          className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setInvoicePage(Math.min(totalInvoicePages - 1, invoicePage + 1))}
                          disabled={invoicePage >= totalInvoicePages - 1}
                          className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Contacts */}
            <TabsContent value="contacts">
              {conLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No contacts synced yet. Connect Xero and run a sync.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-mono uppercase text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c: any) => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {c.is_customer && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Customer</Badge>}
                              {c.is_supplier && <Badge variant="outline" className="text-[10px] bg-norman-info/10 text-norman-info border-norman-info/20">Supplier</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[10px] ${c.contact_status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
                              {c.contact_status || "Unknown"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Sync Logs */}
            <TabsContent value="sync-logs">
              {slLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : syncLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No sync activity yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {syncLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${log.status === "completed" ? "bg-norman-success" : log.status === "failed" ? "bg-destructive" : "bg-norman-warning animate-pulse"}`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.integration} — {log.sync_type}</p>
                          <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={log.status === "completed" ? "bg-norman-success/10 text-norman-success" : log.status === "failed" ? "bg-destructive/10 text-destructive" : ""}>
                          {log.status}
                        </Badge>
                        {log.records_synced > 0 && (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">{log.records_synced} records</p>
                        )}
                        {log.error_message && (
                          <p className="text-xs text-destructive mt-0.5 max-w-xs truncate">{log.error_message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Operations;
