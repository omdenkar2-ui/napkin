"use client";

import { PatternCard } from "./pattern-card";
import type { PatternCluster } from "@/types/api";

interface PatternListProps {
  clusters: PatternCluster[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function PatternList({
  clusters,
  selectedIds,
  onToggle,
}: PatternListProps) {
  // Sort by severity_score descending (critical first)
  const sorted = [...clusters].sort(
    (a, b) => b.severity_score - a.severity_score,
  );

  return (
    <div className="space-y-3">
      {sorted.map((cluster, i) => {
        const clusterId = cluster.id ?? String(cluster.cluster_id ?? i);
        return (
          <PatternCard
            key={clusterId}
            cluster={cluster}
            selected={selectedIds.has(clusterId)}
            onToggle={() => onToggle(clusterId)}
          />
        );
      })}
    </div>
  );
}
