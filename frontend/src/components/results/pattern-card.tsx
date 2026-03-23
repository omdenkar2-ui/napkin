"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PatternCluster } from "@/types/api";

type Severity = "critical" | "opportunity" | "insight";

function getSeverity(score: number): Severity {
  if (score >= 0.7) return "critical";
  if (score >= 0.4) return "opportunity";
  return "insight";
}

function getSeverityLabel(severity: Severity): string {
  return severity.toUpperCase();
}

interface PatternCardProps {
  cluster: PatternCluster;
  selected: boolean;
  onToggle: () => void;
}

export function PatternCard({ cluster, selected, onToggle }: PatternCardProps) {
  const severity = getSeverity(cluster.severity_score);

  const evidenceTags: string[] = [];
  if (cluster.evidence_quotes.length > 0) {
    evidenceTags.push(
      `${cluster.evidence_quotes.length} evidence${cluster.evidence_quotes.length !== 1 ? "s" : ""}`,
    );
  }
  if (cluster.frequency > 0) {
    evidenceTags.push(`${cluster.frequency} mentions`);
  }
  if (cluster.confidence > 0) {
    evidenceTags.push(`${Math.round(cluster.confidence * 100)}% confidence`);
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full text-left bg-surface border rounded-xl p-5 transition-all",
        selected
          ? "border-accent-light ring-1 ring-accent/30"
          : "border-border hover:border-muted",
      )}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div
          className={cn(
            "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
            selected
              ? "bg-accent border-accent-light"
              : "border-muted/40 hover:border-muted",
          )}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={severity}>{getSeverityLabel(severity)}</Badge>
          </div>
          <h3 className="text-foreground text-sm font-medium leading-snug">
            {cluster.pain_summary || cluster.label}
          </h3>

          {evidenceTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {evidenceTags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-muted bg-background border border-border rounded-md px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
