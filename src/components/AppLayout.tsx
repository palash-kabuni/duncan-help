import { useState } from "react";
import Sidebar, { MobileMenuButton } from "@/components/Sidebar";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="lg:ml-64 flex-1 flex flex-col min-h-[100dvh] w-full">
        {/* Mobile header with menu button - only shows on pages that don't provide their own */}
        <div className="lg:hidden flex items-center gap-2 border-b border-border px-4 py-3">
          <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
          <span className="text-sm font-bold text-foreground">Duncan</span>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
