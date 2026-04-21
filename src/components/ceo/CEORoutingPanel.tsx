import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface RoutingRow {
  owner_key: string;
  email: string | null;
  display_name: string;
}

const CEORoutingPanel = () => {
  const [rows, setRows] = useState<RoutingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ceo_action_routing")
      .select("owner_key, email, display_name")
      .order("display_name");
    if (error) toast({ title: "Failed to load routing", description: error.message, variant: "destructive" });
    setRows((data as RoutingRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateRow = (key: string, patch: Partial<RoutingRow>) => {
    setRows((prev) => prev.map((r) => (r.owner_key === key ? { ...r, ...patch } : r)));
  };

  const saveRow = async (row: RoutingRow) => {
    setSaving(row.owner_key);
    const { error } = await supabase
      .from("ceo_action_routing")
      .update({ email: row.email?.trim() || null, display_name: row.display_name })
      .eq("owner_key", row.owner_key);
    setSaving(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: `${row.display_name} updated.` });
  };

  const addRow = async () => {
    const owner_key = prompt("Owner key (e.g. dave_design):")?.trim();
    if (!owner_key) return;
    const display_name = prompt("Display name (e.g. Dave (Design Lead)):")?.trim() || owner_key;
    const { error } = await supabase.from("ceo_action_routing").insert({ owner_key, display_name, email: null });
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else load();
  };

  const deleteRow = async (key: string) => {
    if (!confirm("Remove this owner from routing?")) return;
    const { error } = await supabase.from("ceo_action_routing").delete().eq("owner_key", key);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Action routing</h3>
          <p className="text-xs text-muted-foreground">Map each leadership owner to a real email address.</p>
        </div>
        <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.owner_key} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <Input value={r.display_name} onChange={(e) => updateRow(r.owner_key, { display_name: e.target.value })} className="h-8 text-sm" />
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{r.owner_key}</p>
              </div>
              <div className="col-span-6">
                <Input
                  type="email"
                  placeholder="email@kabuni.com"
                  value={r.email || ""}
                  onChange={(e) => updateRow(r.owner_key, { email: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2 flex gap-1">
                <Button size="sm" variant="outline" onClick={() => saveRow(r)} disabled={saving === r.owner_key} className="h-8 px-2">
                  <Save className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteRow(r.owner_key)} className="h-8 px-2 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CEORoutingPanel;
