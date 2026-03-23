"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSessions, getSession } from "@/lib/api/sessions";
import { getOrCreateDefaultProject } from "@/lib/api/projects";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import type { PatternReport, PatternCluster } from "@/types/api";
import Link from "next/link";

function getSeverityVariant(
  score: number,
): "critical" | "opportunity" | "insight" {
  if (score >= 0.7) return "critical";
  if (score >= 0.4) return "opportunity";
  return "insight";
}

export default function InsightsPage() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateDefaultProject().then((p) => setProjectId(p.id));
  }, []);

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["sessions", projectId],
    queryFn: () => listSessions(projectId!, 50, 0),
    enabled: !!projectId,
  });

  // Fetch completed sessions to get pattern reports
  const completedIds = useMemo(
    () =>
      (sessions || [])
        .filter((s) => s.stage === "done")
        .map((s) => s.id),
    [sessions],
  );

  const { data: fullSessions, isLoading: loadingDetails } = useQuery({
    queryKey: ["sessions-details", completedIds],
    queryFn: () => Promise.all(completedIds.map(getSession)),
    enabled: completedIds.length > 0,
  });

  // Aggregate all patterns
  const allPatterns = useMemo(() => {
    if (!fullSessions) return [];
    const patterns: (PatternCluster & { sessionId: string })[] = [];
    for (const s of fullSessions) {
      const report = s.pattern_report as PatternReport | null;
      if (report?.clusters) {
        for (const c of report.clusters) {
          patterns.push({ ...c, sessionId: s.id });
        }
      }
    }
    return patterns.sort((a, b) => b.severity_score - a.severity_score);
  }, [fullSessions]);

  const isLoading = loadingSessions || loadingDetails;

  if (isLoading || !projectId) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-serif text-2xl text-foreground mb-1">Insights</h1>
      <p className="text-sm text-muted mb-6">
        Patterns discovered across all your feedback sessions
      </p>

      {allPatterns.length > 0 ? (
        <div className="space-y-3">
          {allPatterns.map((pattern, idx) => (
            <Link
              key={`${pattern.id}-${idx}`}
              href={`/sessions/${pattern.sessionId}`}
              className="block bg-surface border border-border rounded-xl p-5 hover:border-muted transition-colors"
            >
              <div className="flex items-start gap-3">
                <Badge variant={getSeverityVariant(pattern.severity_score)}>
                  {getSeverityVariant(pattern.severity_score).toUpperCase()}
                </Badge>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm text-foreground font-medium">
                    {pattern.pain_summary || pattern.label}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-muted">
                      {pattern.frequency} mentions
                    </span>
                    <span className="text-xs text-muted">
                      {pattern.evidence_quotes.length} evidence
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          }
          title="No insights yet"
          description="Complete a feedback analysis session to see patterns here."
          action={
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-foreground hover:bg-border transition-colors"
            >
              Analyze feedback
            </Link>
          }
        />
      )}
    </div>
  );
}
