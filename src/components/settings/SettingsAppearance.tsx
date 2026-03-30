import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const themes = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

export default function SettingsAppearance() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Appearance</h3>
        <p className="text-xs text-muted-foreground">Choose how Duncan looks</p>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-3 block">Theme</Label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => {
            const Icon = t.icon;
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-150",
                  isActive
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-secondary/40"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Font Size</Label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">A</span>
          <div className="flex-1 h-1.5 rounded-full bg-secondary relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary border-2 border-primary-foreground shadow-sm cursor-pointer" />
          </div>
          <span className="text-base text-muted-foreground font-semibold">A</span>
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-1">Default — coming soon</p>
      </div>
    </div>
  );
}
