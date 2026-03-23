"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { listSessions } from "@/lib/api/sessions";
import { getOrCreateDefaultProject, getProject } from "@/lib/api/projects";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { NewAnalysisDialog } from "@/components/sessions/new-analysis-dialog";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";

export default function SessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      }
    >
      <SessionsContent />
    </Suspense>
  );
}

function SessionsContent() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("project");
  const [showNewAnalysis, setShowNewAnalysis] = useState(false);

  // When a project ID is in the URL, use it directly — no effect needed
  // Only fall back to default when there's no URL param
  const [fallbackProjectId, setFallbackProjectId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!urlProjectId) {
      getOrCreateDefaultProject().then((p) => setFallbackProjectId(p.id));
    }
  }, [urlProjectId]);

  // The actual project ID to use: URL param takes priority
  const projectId = urlProjectId || fallbackProjectId;

  // Fetch project name when viewing a specific project
  const { data: project } = useQuery({
    queryKey: ["project", urlProjectId],
    queryFn: () => getProject(urlProjectId!),
    enabled: !!urlProjectId,
    staleTime: 60_000,
  });

  const projectName = project?.name || null;

  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sessions", projectId],
    queryFn: () => listSessions(projectId!, 50, 0),
    enabled: !!projectId,
  });

  if (isLoading || !projectId) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
          title="Could not load sessions"
          description="Make sure the backend is running."
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {projectName && (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Dashboard
                </Link>
                <span className="text-sm text-muted">/</span>
              </>
            )}
            <h1 className="font-serif text-2xl text-foreground">
              {projectName || "Sessions"}
            </h1>
          </div>
          <p className="text-sm text-muted">
            {projectName
              ? "Sessions for this project"
              : "Your feedback analysis history"}
          </p>
        </div>
        <button
          onClick={() => setShowNewAnalysis(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] text-sm font-medium bg-accent text-accent-foreground hover:bg-accent-light transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New analysis
        </button>
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="block bg-surface border border-border rounded-xl p-4 hover:border-muted transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm text-foreground font-medium truncate">
                    {s.title || "Untitled session"}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {formatRelative(s.created_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    s.stage === "done"
                      ? "success"
                      : s.stage === "error"
                        ? "error"
                        : "accent"
                  }
                >
                  {s.stage === "done"
                    ? "Complete"
                    : s.stage === "error"
                      ? "Error"
                      : "Processing"}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          title="No sessions yet"
          description={
            projectName
              ? `No sessions in "${projectName}" yet. Start a new analysis.`
              : "Start by uploading feedback on the Dashboard."
          }
          action={
            <button
              onClick={() => setShowNewAnalysis(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-foreground hover:bg-border transition-colors"
            >
              Start new analysis
            </button>
          }
        />
      )}

      {projectId && (
        <NewAnalysisDialog
          open={showNewAnalysis}
          onClose={() => setShowNewAnalysis(false)}
          projectId={projectId}
          projectName={projectName}
        />
      )}
    </div>
  );
}
