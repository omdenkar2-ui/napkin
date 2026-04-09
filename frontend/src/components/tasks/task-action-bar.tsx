"use client";

import { ChevronDown } from "lucide-react";

interface TaskActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSend: () => void;
}

export function TaskActionBar({ selectedCount, totalCount, onSend }: TaskActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-[--surface] border-t border-[--border] shadow-lg px-6 py-3 flex items-center justify-between">
      <span className="text-[13px] font-medium text-[--text-primary]">
        {selectedCount} of {totalCount} tasks selected
      </span>

      <button
        type="button"
        className="inline-flex items-center gap-1.5 h-9 px-3 border border-[--border] rounded-md text-sm text-[--text-secondary] hover:border-[--border-strong] transition-colors"
      >
        Send to: Linear
        <ChevronDown className="w-3.5 h-3.5 text-[--text-muted]" />
      </button>

      <button
        type="button"
        onClick={onSend}
        className="h-10 px-6 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
      >
        Approve & Send {selectedCount} Tasks
      </button>
    </div>
  );
}
