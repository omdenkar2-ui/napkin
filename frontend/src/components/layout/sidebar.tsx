"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  CheckSquare,
  Zap,
  Plug,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNav = [
  { label: "Home", icon: LayoutDashboard, href: "/" },
  { label: "Sessions", icon: BarChart3, href: "/sessions" },
  { label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { label: "Workflows", icon: Zap, href: "/workflows" },
];

const secondaryNav = [
  { label: "Integrations", icon: Plug, href: "/integrations" },
  { label: "Team", icon: Users, href: "/team" },
];

// Context for sidebar state
interface SidebarContextValue {
  collapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, setMobileOpen }}>
      <Sidebar collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      {children}
    </SidebarContext.Provider>
  );
}

// Mobile hamburger button (rendered by layout in the header)
export function MobileMenuButton() {
  const { setMobileOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      className="md:hidden w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Close mobile sidebar on navigation
  useEffect(() => {
    onMobileClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const navItemClass = (active: boolean) =>
    cn(
      "flex items-center h-9 rounded-lg text-[13px] font-medium transition-all duration-150",
      collapsed ? "justify-center px-0 w-9 mx-auto" : "gap-2.5 px-3",
      active
        ? "bg-[rgba(27,107,122,0.15)] text-white border-l-2 border-l-[#1B6B7A]"
        : "text-white/50 hover:bg-white/[0.06] hover:text-white/90",
    );

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn("py-5 flex items-center border-b border-white/[0.06]", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo_clean_final.png" className="w-7 h-7 object-contain" alt="Napkin" />
          {!collapsed && (
            <>
              <span className="text-[16px] font-semibold text-white tracking-[-0.01em]">Napkin</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B7A]" />
            </>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        <ul className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={navItemClass(isActive(item.href))} title={collapsed ? item.label : undefined}>
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="my-3 border-t border-white/[0.06]" />

        <ul className="flex flex-col gap-0.5">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={navItemClass(isActive(item.href))} title={collapsed ? item.label : undefined}>
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="my-3 border-t border-white/[0.06]" />

        <Link href="/settings" className={navItemClass(isActive("/settings"))} title={collapsed ? "Settings" : undefined}>
          <Settings className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && "Settings"}
        </Link>
      </nav>

      {/* Collapse toggle (hidden on mobile) */}
      <div className="hidden md:block border-t border-white/[0.06] p-2">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex items-center h-8 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150 w-full",
            collapsed ? "justify-center" : "gap-2.5 px-3",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
          {!collapsed && <span className="text-[13px] font-medium">Collapse</span>}
        </button>
      </div>

      {/* User section */}
      <div className={cn("border-t border-white/[0.06] py-4 px-4", collapsed && "flex justify-center px-2")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <div className="w-8 h-8 rounded-full bg-white/[0.08] ring-1 ring-white/10 shrink-0" />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-medium text-white/80 truncate">Account</span>
              <span className="text-[11px] text-white/40">Member</span>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen border-r border-white/[0.06] flex-col z-40 transition-all duration-200 hidden md:flex [background:linear-gradient(180deg,#1A1A1A_0%,#151515_100%)]",
          collapsed ? "w-14" : "w-64",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 w-64 h-screen bg-[--sidebar-bg] border-r border-white/[0.06] flex flex-col">
            {/* Close button */}
            <button
              type="button"
              onClick={onMobileClose}
              className="absolute top-4 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] z-10"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
