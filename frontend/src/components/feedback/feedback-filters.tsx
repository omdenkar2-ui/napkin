"use client";

import { Search, ChevronDown } from "lucide-react";

interface FeedbackFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
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

export function FeedbackFilters({ search, onSearchChange }: FeedbackFiltersProps) {
  return (
    <div className="flex items-center gap-3 py-3 px-5 border-b border-[--border] sticky top-0 bg-[--background] z-10">
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[--text-muted]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search feedback..."
          className="w-full h-8 pl-9 pr-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
        />
      </div>
      <FilterButton label="Source" />
      <FilterButton label="Last 30 days" />
      <FilterButton label="Sentiment" />
      <FilterButton label="Status" />
    </div>
  );
}
