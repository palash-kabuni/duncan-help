import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, FileText, CheckCircle, Clock, XCircle, Upload, TrendingUp } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/hooks/useUserRoles";
import POForm from "@/components/po/POForm";
import POList from "@/components/po/POList";
import POApprovals from "@/components/po/POApprovals";
import BudgetOverview from "@/components/po/BudgetOverview";
import BudgetUpload from "@/components/po/BudgetUpload";
import DepartmentManager from "@/components/po/DepartmentManager";

const PurchaseOrders = () => {
  const [showForm, setShowForm] = useState(false);
  const { isAdmin } = useIsAdmin();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 flex-1">
        <div className="pointer-events-none fixed top-0 left-64 right-0 h-72 gradient-radial z-0" />

        <div className="relative z-10 px-8 py-8 max-w-6xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  Purchase Orders
                </p>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  Procurement & <span className="text-primary glow-text">Budget</span>
                </h2>
              </div>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Raise PO
              </Button>
            </div>
          </motion.div>

          <Tabs defaultValue="orders" className="space-y-6">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="orders" className="gap-2">
                <FileText className="h-3.5 w-3.5" /> My Orders
              </TabsTrigger>
              <TabsTrigger value="approvals" className="gap-2">
                <Clock className="h-3.5 w-3.5" /> Approvals
              </TabsTrigger>
              <TabsTrigger value="budget" className="gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Budget
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="admin" className="gap-2">
                  <Upload className="h-3.5 w-3.5" /> Admin
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="orders">
              <POList />
            </TabsContent>

            <TabsContent value="approvals">
              <POApprovals />
            </TabsContent>

            <TabsContent value="budget">
              <BudgetOverview />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="admin" className="space-y-6">
                <DepartmentManager />
                <BudgetUpload />
              </TabsContent>
            )}
          </Tabs>

          {showForm && <POForm onClose={() => setShowForm(false)} />}
        </div>
      </main>
    </div>
  );
};

export default PurchaseOrders;
