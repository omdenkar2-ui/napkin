"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ContextFormProps {
  onContextChange: (context: { segment: string; constraints: string }) => void;
}

export function ContextForm({ onContextChange }: ContextFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [segment, setSegment] = useState("");
  const [constraints, setConstraints] = useState("");

  const handleChange = (field: "segment" | "constraints", value: string) => {
    const next =
      field === "segment"
        ? { segment: value, constraints }
        : { segment, constraints: value };
    if (field === "segment") setSegment(value);
    else setConstraints(value);
    onContextChange(next);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors mx-auto"
      >
        <svg
          className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
        Add context (optional)
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 bg-surface border border-border rounded-xl p-4">
          <div>
            <label className="block text-xs text-muted mb-1">
              Target segment / user
            </label>
            <input
              type="text"
              placeholder="e.g., Enterprise customers, new signups..."
              value={segment}
              onChange={(e) => handleChange("segment", e.target.value)}
              className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-muted"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">
              Constraints or non-goals
            </label>
            <input
              type="text"
              placeholder="e.g., No breaking changes, mobile only..."
              value={constraints}
              onChange={(e) => handleChange("constraints", e.target.value)}
              className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-muted"
            />
          </div>
        </div>
      )}
    </div>
  );
}
