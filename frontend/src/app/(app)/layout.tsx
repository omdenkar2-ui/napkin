"use client";

import { SidebarProvider, useSidebar, MobileMenuButton } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/command-palette/command-palette";

function AppContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <>
      {/* Mobile header with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-[--border] flex items-center px-4 bg-[--background] z-30">
        <MobileMenuButton />
      </div>
      <main
        className="min-h-screen bg-[--background] transition-all duration-200 pt-14 md:pt-0"
        style={{ marginLeft: collapsed ? 56 : 256 }}
      >
        <style>{`@media (max-width: 767px) { main { margin-left: 0 !important; } }`}</style>
        {children}
      </main>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen">
        <AppContent>{children}</AppContent>
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}
