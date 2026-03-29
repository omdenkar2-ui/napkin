"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSessions, getSession } from "@/lib/api/sessions";
import { getOrCreateDefaultProject } from "@/lib/api/projects";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

function getSeverityVariant(
  score: number,
): "critical" | "opportunity" | "insight" {
  if (score >= 7) return "critical";
  if (score >= 4) return "opportunity";
  return "insight";
}

interface EnrichedPattern {
  label: string;
  pain_summary: string;
  frequency: number;
  severity_score: number;
  confidence: number;
  evidence_quotes: string[];
  signal_ids: string[];
  sessionId: string;
  sessionCreatedAt: string;
  sessionTitle: string | null;
}

function inferTeam(pattern: EnrichedPattern): string {
  const text = (pattern.label + " " + pattern.pain_summary).toLowerCase();
  if (text.match(/api|backend|server|database|query|slow|sync|rate.limit|webhook/)) return "Engineering";
  if (text.match(/ui|button|screen|layout|design|navigate|modal|sidebar|dark.mode|contrast/)) return "Product & Design";
  if (text.match(/report|export|csv|pdf|data|chart|analytics/)) return "Data";
  if (text.match(/auth|login|permission|role|sso|saml|2fa|security|audit/)) return "Security";
  if (text.match(/pricing|cost|tier|plan|discount|seat/)) return "Business";
  if (text.match(/onboard|tutorial|wizard|welcome|getting.started/)) return "Growth";
  return "Product";
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): [string, T[]][] {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (groups[key] ||= []).push(item);
  }
  return Object.entries(groups);
}

export default function InsightsPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [groupByMode, setGroupByMode] = useState<"month" | "team">("month");

  useEffect(() => {
    getOrCreateDefaultProject().then((p) => setProjectId(p.id));
  }, []);

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["sessions", projectId],
    queryFn: () => listSessions(projectId!, 50, 0),
    enabled: !!projectId,
  });

  const completedIds = useMemo(
    () => (sessions || []).filter((s) => s.stage === "done").map((s) => s.id),
    [sessions],
  );

  const { data: fullSessions, isLoading: loadingDetails } = useQuery({
    queryKey: ["sessions-details", completedIds],
    queryFn: () => Promise.all(completedIds.map(getSession)),
    enabled: completedIds.length > 0,
  });

  const allPatterns = useMemo(() => {
    if (!fullSessions) return [];
    const patterns: EnrichedPattern[] = [];
    for (const s of fullSessions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const report = s.pattern_report as any;
      const clusters = report?.clusters ?? [];
      for (const c of clusters) {
        patterns.push({
          label: c.label || "",
          pain_summary: c.pain_summary || "",
          frequency: c.frequency || 0,
          severity_score: c.severity_score || 0,
          confidence: c.confidence || 0,
          evidence_quotes: Array.isArray(c.evidence_quotes) ? c.evidence_quotes : [],
          signal_ids: c.signal_ids || [],
          sessionId: s.id,
          sessionCreatedAt: s.created_at,
          sessionTitle: s.title,
        });
      }
    }
    return patterns.sort((a, b) => b.severity_score - a.severity_score);
  }, [fullSessions]);

  const grouped = useMemo(() => {
    if (groupByMode === "team") {
      return groupBy(allPatterns, inferTeam).sort(
        (a, b) => b[1].length - a[1].length,
      );
    }
    // By month
    return groupBy(allPatterns, (p) => {
      const d = new Date(p.sessionCreatedAt);
      return d.toLocaleString("default", { month: "long", year: "numeric" });
    });
  }, [allPatterns, groupByMode]);

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
      <p className="text-sm text-muted mb-4">
        Patterns discovered across all your feedback sessions
      </p>

      {allPatterns.length > 0 ? (
        <>
          {/* Group toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setGroupByMode("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                groupByMode === "month"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              By Month
            </button>
            <button
              onClick={() => setGroupByMode("team")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                groupByMode === "team"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              By Team
            </button>
          </div>

          {grouped.map(([heading, items]) => (
            <div key={heading} className="mb-8">
              <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                {heading} &middot; {items.length} pattern{items.length !== 1 ? "s" : ""}
              </h2>
              <div className="space-y-3">
                {items.map((pattern, idx) => (
                  <Link
                    key={`${pattern.sessionId}-${idx}`}
                    href={`/sessions/${pattern.sessionId}`}
                    className="block bg-surface border border-border rounded-xl p-5 hover:border-muted transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Badge variant={getSeverityVariant(pattern.severity_score)}>
                        {getSeverityVariant(pattern.severity_score).toUpperCase()}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm text-foreground font-medium">
                          {pattern.label || pattern.pain_summary}
                        </h3>
                        {pattern.pain_summary && pattern.label && (
                          <p className="text-xs text-muted mt-1 line-clamp-2">{pattern.pain_summary}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-xs text-muted">{pattern.frequency} mentions</span>
                          <span className="text-xs text-muted">{Math.round(pattern.confidence * 100)}% confidence</span>
                          {pattern.sessionTitle && (
                            <span className="text-xs text-muted/60">from {pattern.sessionTitle}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </>
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
