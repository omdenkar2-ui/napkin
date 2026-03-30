"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

interface SessionsSortFilterProps {
  sortBy: "most_recent" | "oldest" | "title_az" | "title_za";
  filterStatus: "all" | "spec_ready" | "processing" | "patterns_ready" | "archived" | "no_patterns";
  onSortChange: (sort: SessionsSortFilterProps["sortBy"]) => void;
  onFilterChange: (filter: SessionsSortFilterProps["filterStatus"]) => void;
  totalCount: number;
  filteredCount: number;
}

const SORT_OPTIONS = [
  { value: "most_recent", label: "Most recent" },
  { value: "oldest",      label: "Oldest first" },
  { value: "title_az",    label: "Title A–Z" },
  { value: "title_za",    label: "Title Z–A" },
] as const;

const FILTER_OPTIONS = [
  { value: "all",            label: "All sessions" },
  { value: "spec_ready",     label: "Spec ready" },
  { value: "processing",     label: "Processing" },
  { value: "patterns_ready", label: "Patterns ready" },
  { value: "no_patterns",    label: "No patterns" },
  { value: "archived",       label: "Archived" },
] as const;

export function SessionsSortFilter({
  sortBy,
  filterStatus,
  onSortChange,
  onFilterChange,
  totalCount,
  filteredCount,
}: SessionsSortFilterProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const currentSort = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Most recent";
  const currentFilter = FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label ?? "All sessions";

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Left: count */}
      <p className="text-[13px] text-[rgba(255,255,255,0.35)]">
        {filteredCount === totalCount
          ? `${totalCount} session${totalCount !== 1 ? "s" : ""}`
          : `${filteredCount} of ${totalCount} session${totalCount !== 1 ? "s" : ""}`}
      </p>

      {/* Right: filter + sort dropdowns */}
      <div className="flex items-center gap-2">

        {/* Filter dropdown */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={() => { setFilterOpen((p) => !p); setSortOpen(false); }}
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium transition-all border",
              filterOpen || filterStatus !== "all"
                ? "bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.88)] border-[rgba(255,255,255,0.15)]"
                : "bg-transparent text-[rgba(255,255,255,0.50)] border-[rgba(255,255,255,0.09)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(255,255,255,0.72)]"
            )}
          >
            <SlidersHorizontal size={13} className="opacity-70" />
            {currentFilter}
            {filterStatus !== "all" && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] ml-0.5" />
            )}
          </button>

          <AnimatePresence>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => setFilterOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ duration: 0.10 }}
                  className="absolute top-10 right-0 z-50 min-w-[172px] bg-[#1c1c1a] border border-[rgba(255,255,255,0.10)] rounded-xl shadow-2xl overflow-hidden py-1"
                >
                  {FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={() => { onFilterChange(opt.value); setFilterOpen(false); }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-[13px] transition-colors text-left",
                        filterStatus === opt.value
                          ? "text-[rgba(255,255,255,0.92)] bg-[rgba(255,255,255,0.07)]"
                          : "text-[rgba(255,255,255,0.62)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(255,255,255,0.88)]"
                      )}
                    >
                      {opt.label}
                      {filterStatus === opt.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white opacity-70" />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={() => { setSortOpen((p) => !p); setFilterOpen(false); }}
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium transition-all border",
              sortOpen
                ? "bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.88)] border-[rgba(255,255,255,0.15)]"
                : "bg-transparent text-[rgba(255,255,255,0.50)] border-[rgba(255,255,255,0.09)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(255,255,255,0.72)]"
            )}
          >
            {currentSort}
            <ChevronDown size={13} className={cn("opacity-60 transition-transform", sortOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => setSortOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ duration: 0.10 }}
                  className="absolute top-10 right-0 z-50 min-w-[160px] bg-[#1c1c1a] border border-[rgba(255,255,255,0.10)] rounded-xl shadow-2xl overflow-hidden py-1"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={() => { onSortChange(opt.value); setSortOpen(false); }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-[13px] transition-colors text-left",
                        sortBy === opt.value
                          ? "text-[rgba(255,255,255,0.92)] bg-[rgba(255,255,255,0.07)]"
                          : "text-[rgba(255,255,255,0.62)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(255,255,255,0.88)]"
                      )}
                    >
                      {opt.label}
                      {sortBy === opt.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white opacity-70" />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
