"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Building, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { label: "Profile", icon: User, href: "/settings/profile" },
  { label: "Workspace", icon: Building, href: "/settings/workspace" },
  { label: "Notifications", icon: Bell, href: "/settings/notifications" },
];

interface SettingsLayoutProps {
  children: ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-56px)]">
      {/* Mobile: horizontal tabs */}
      <div className="md:hidden flex overflow-x-auto gap-1 px-4 py-2 border-b border-[--border]">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap shrink-0",
                active
                  ? "text-[--primary] bg-[--primary-soft]/60"
                  : "text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--surface-alt]/50",
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Desktop: left sidebar tabs */}
      <div className="hidden md:block w-[200px] pr-6 border-r border-[--border] shrink-0 py-8 pl-8">
        <h2 className="text-lg font-semibold text-[--text-primary] mb-6">Settings</h2>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "text-[--primary] bg-[--primary-soft]/60"
                    : "text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--surface-alt]/50",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 md:pl-6 max-w-[560px] py-8 px-4 md:px-0">
        {children}
      </div>
    </div>
  );
}
