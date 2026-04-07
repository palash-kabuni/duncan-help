import { useState, useRef, useEffect } from "react";
import { Check, X, Users, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/hooks/useWorkstreams";

interface MultiAssigneeSelectProps {
  users: UserProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  compact?: boolean;
}

export default function MultiAssigneeSelect({
  users,
  selectedIds,
  onChange,
  placeholder = "Assign people…",
  compact = false,
}: MultiAssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (userId: string) => {
    onChange(
      selectedIds.includes(userId)
        ? selectedIds.filter(id => id !== userId)
        : [...selectedIds, userId]
    );
  };

  const selectedUsers = users.filter(u => selectedIds.includes(u.user_id));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 w-full text-left border border-input rounded-md bg-background transition-colors hover:bg-accent/50 ${
          compact ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"
        }`}
      >
        {selectedUsers.length === 0 ? (
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Users className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {placeholder}
          </span>
        ) : (
          <div className="flex items-center gap-1 flex-1 overflow-hidden">
            {selectedUsers.slice(0, compact ? 2 : 3).map(u => (
              <Badge key={u.user_id} variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">
                {(u.display_name || "?").split(" ")[0]}
              </Badge>
            ))}
            {selectedUsers.length > (compact ? 2 : 3) && (
              <span className="text-[10px] text-muted-foreground">+{selectedUsers.length - (compact ? 2 : 3)}</span>
            )}
          </div>
        )}
        <ChevronDown className={`shrink-0 text-muted-foreground ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[180px] max-h-[200px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {users.map(u => {
            const isSelected = selectedIds.includes(u.user_id);
            return (
              <button
                key={u.user_id}
                type="button"
                onClick={() => toggle(u.user_id)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                  isSelected ? "bg-primary border-primary" : "border-input"
                }`}>
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="truncate">{u.display_name || "Unnamed"}</span>
                {u.role_title && (
                  <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[80px]">{u.role_title}</span>
                )}
              </button>
            );
          })}
          {users.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">No users available</div>
          )}
        </div>
      )}
    </div>
  );
}
