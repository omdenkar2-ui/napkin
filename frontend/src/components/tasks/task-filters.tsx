"use client";

import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTab = "all" | "pending" | "approved" | "sent";

interface TaskFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
  counts: { pending: number; approved: number; sent: number };
}

function FilterButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 h-8 px-3 border border-[--border] rounded-lg text-xs font-medium text-[--text-secondary] hover:border-[--border-strong] hover:bg-[--surface-alt]/50 transition-all duration-100 shrink-0"
    >
      {label}
      <ChevronDown className="w-3.5 h-3.5 text-[--text-muted]" />
    </button>
  );
}

const TABS: { value: StatusTab; label: string; countKey?: keyof TaskFiltersProps["counts"] }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending", countKey: "pending" },
  { value: "approved", label: "Approved", countKey: "approved" },
  { value: "sent", label: "Sent", countKey: "sent" },
];

export function TaskFilters({ search, onSearchChange, activeTab, onTabChange, counts }: TaskFiltersProps) {
  return (
    <div className="flex items-center gap-3 py-3 px-5 border-b border-[--border]">
      <div className="relative w-56">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[--text-muted]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tasks..."
          className="w-full h-8 pl-9 pr-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
        />
      </div>
      <FilterButton label="Status" />
      <FilterButton label="Priority" />
      <FilterButton label="Assignee" />
      <FilterButton label="Analysis" />

      {/* Status tabs */}
      <div className="flex items-center gap-1 ml-auto">
        {TABS.map((tab) => {
          const count = tab.countKey ? counts[tab.countKey] : undefined;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold h-7 px-2.5 rounded-md transition-colors",
                isActive
                  ? "bg-[--primary] text-white"
                  : "text-[--text-muted] hover:bg-[--surface-hover]",
              )}
            >
              {tab.label}
              {count !== undefined && (
                <span className={cn(
                  "text-[10px] font-medium px-1 rounded min-w-[18px] text-center",
                  isActive ? "bg-white/20 text-white" : "bg-[--surface-alt] text-[--text-muted]",
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
