import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBudgets } from "@/hooks/useBudgets";
import { useDepartments } from "@/hooks/useDepartments";

export default function BudgetOverview() {
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: departments = [] } = useDepartments();

  const getDeptName = (id: string) => departments.find(d => d.id === id)?.name ?? "—";

  // Group by department
  const grouped = budgets.reduce<Record<string, typeof budgets>>((acc, b) => {
    if (!acc[b.department_id]) acc[b.department_id] = [];
    acc[b.department_id].push(b);
    return acc;
  }, {});

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading budgets...</p>;

  if (budgets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No budgets configured yet. Ask an admin to upload budget data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([deptId, items]) => {
        const totalAllocated = items.reduce((s, b) => s + Number(b.allocated_amount), 0);
        const totalSpent = items.reduce((s, b) => s + Number(b.spent_amount), 0);
        const pct = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

        return (
          <Card key={deptId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{getDeptName(deptId)}</CardTitle>
                <span className="text-xs font-mono text-muted-foreground">
                  £{totalSpent.toLocaleString("en-GB", { minimumFractionDigits: 2 })} / £{totalAllocated.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Progress value={Math.min(pct, 100)} className="h-2" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {items.map(b => {
                  const iPct = Number(b.allocated_amount) > 0 ? (Number(b.spent_amount) / Number(b.allocated_amount)) * 100 : 0;
                  return (
                    <div key={b.id} className="rounded-md border border-border bg-secondary/20 px-3 py-2">
                      <p className="text-[10px] font-mono uppercase text-muted-foreground">{b.category.replace("_", " ")}</p>
                      <p className="text-sm font-medium text-foreground">
                        £{Number(b.spent_amount).toLocaleString("en-GB")} <span className="text-muted-foreground">/ £{Number(b.allocated_amount).toLocaleString("en-GB")}</span>
                      </p>
                      <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full ${iPct > 90 ? "bg-destructive" : iPct > 70 ? "bg-norman-warning" : "bg-primary"}`} style={{ width: `${Math.min(iPct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
