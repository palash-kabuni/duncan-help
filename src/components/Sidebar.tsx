import { Brain, LayoutDashboard, Plug, Settings, LogOut, UserCircle, ShoppingCart, Users, Activity, MessageSquareWarning } from "lucide-react";
import { NavLink as RouterNavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
const navItems = [{
  icon: LayoutDashboard,
  label: "Dashboard",
  to: "/"
}, {
  icon: ShoppingCart,
  label: "Purchase Orders",
  to: "/purchase-orders"
}, {
  icon: Users,
  label: "Recruitment",
  to: "/recruitment"
}, {
  icon: Activity,
  label: "Operations",
  to: "/operations"
}, {
  icon: Plug,
  label: "Integrations",
  to: "/integrations"
}, {
  icon: UserCircle,
  label: "Profile",
  to: "/profile"
}, {
  icon: MessageSquareWarning,
  label: "Feedback / Issues",
  to: "/feedback"
}];
const Sidebar = () => {
  const {
    user,
    signOut
  } = useAuth();
  return <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 glow-primary-sm">
          <Brain className="h-5 w-5 text-primary" />
          <div className="absolute inset-0 rounded-lg border border-primary/20" />
        </div>
        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-lg font-bold tracking-tight text-foreground cursor-default">Duncan</h1>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                <p className="text-xs">A tribute to Nimesh's dog Duncan — the inspiration behind the system.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-[10px] font-mono tracking-widest text-muted-foreground">KabuniOS</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(item => <RouterNavLink key={item.to} to={item.to} className={({
        isActive
      }) => cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150", isActive ? "bg-primary/10 text-primary glow-primary-sm" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
            <item.icon className="h-4 w-4" />
            {item.label}
          </RouterNavLink>)}
      </nav>

      {/* User */}
      <div className="border-t border-border px-4 py-4 space-y-2">
        {user && <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user.email}</p>
            </div>
            <button onClick={signOut} className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors" title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>}
        <RouterNavLink to="/settings" className={({ isActive }) => cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150", isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
          <Settings className="h-3.5 w-3.5" />
          Settings
        </RouterNavLink>
        <p className="text-[10px] font-mono text-muted-foreground/50">v0.1.0</p>
      </div>
    </aside>;
};
export default Sidebar;