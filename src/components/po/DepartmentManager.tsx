import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDepartments, useCreateDepartment } from "@/hooks/useDepartments";
import { Plus, Building2 } from "lucide-react";

export default function DepartmentManager() {
  const { data: departments = [] } = useDepartments();
  const createDept = useCreateDepartment();
  const [name, setName] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createDept.mutateAsync({ name: name.trim() });
    setName("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Departments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="New department name" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()} />
          <Button onClick={handleCreate} disabled={createDept.isPending} size="sm" className="gap-1 shrink-0">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {departments.map(d => (
            <Badge key={d.id} variant="secondary" className="text-xs">{d.name}</Badge>
          ))}
          {departments.length === 0 && <p className="text-xs text-muted-foreground">No departments yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
