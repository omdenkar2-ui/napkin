"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProjectCard } from "@/components/dashboard/project-card";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { listProjects } from "@/lib/api/projects";
import { listSessions } from "@/lib/api/sessions";
import { formatRelative } from "@/lib/utils";
import { getStageIndex, STAGES } from "@/types/session";
import type { SessionStage } from "@/types/api";
import Link from "next/link";

const STAGE_LABELS: Record<string, string> = {
  intake: "Processing feedback...",
  synthesis: "Finding patterns...",
  prioritization: "Ranking opportunities...",
  four_questions: "Analyzing context...",
  spec_building: "Building spec...",
  task_planning: "Creating action plan...",
  export: "Preparing results...",
};

export default function DashboardPage() {
  const [showCreateProject, setShowCreateProject] = useState(false);

  const {
    data: projects,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  // Fetch sessions for all projects to show in-progress / recent
  const firstProjectId = projects?.[0]?.id;
  const { data: sessions } = useQuery({
    queryKey: ["dashboard-sessions", firstProjectId],
    queryFn: () => listSessions(firstProjectId!, 20, 0),
    enabled: !!firstProjectId,
    refetchInterval: 5000,
  });

  const inProgress = useMemo(
    () => (sessions || []).filter((s) => s.stage !== "done" && s.stage !== "error"),
    [sessions],
  );
  const recentCompleted = useMemo(
    () => (sessions || []).filter((s) => s.stage === "done").slice(0, 5),
    [sessions],
  );

  const totalSessions = sessions?.length || 0;
  const completedCount = recentCompleted.length;
  const inProgressCount = inProgress.length;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Manage your feedback analysis projects
          </p>
        </div>
        <Button onClick={() => setShowCreateProject(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New project
        </Button>
      </div>

      {/* Stats row */}
      {totalSessions > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-muted">Total Sessions</p>
            <p className="text-2xl font-serif text-foreground mt-1">{totalSessions}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-muted">Completed</p>
            <p className="text-2xl font-serif text-foreground mt-1">{completedCount}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-muted">In Progress</p>
            <p className="text-2xl font-serif text-foreground mt-1">{inProgressCount}</p>
          </div>
        </div>
      )}

      {/* In-progress sessions */}
      {inProgress.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
            In Progress
          </h2>
          <div className="space-y-2">
            {inProgress.map((s) => {
              const idx = getStageIndex(s.stage as SessionStage);
              const progress = Math.round((idx / (STAGES.length - 2)) * 100); // -2 for done+error
              return (
                <Link
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  className="block bg-surface border border-accent/20 rounded-xl p-4 hover:border-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm text-foreground font-medium truncate">
                      {s.title || `Analysis from ${formatRelative(s.created_at)}`}
                    </h3>
                    <Badge variant="accent">Processing</Badge>
                  </div>
                  <p className="text-xs text-accent mb-2">
                    {STAGE_LABELS[s.stage] || "Processing..."}
                  </p>
                  <div className="w-full bg-border rounded-full h-1">
                    <div
                      className="bg-accent rounded-full h-1 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent completed */}
      {recentCompleted.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
            Recent Completed
          </h2>
          <div className="space-y-2">
            {recentCompleted.map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="block bg-surface border border-border rounded-xl p-4 hover:border-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm text-foreground font-medium truncate">
                      {s.title || `Analysis from ${formatRelative(s.created_at)}`}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      {s.completed_at ? formatRelative(s.completed_at) : formatRelative(s.created_at)}
                    </p>
                  </div>
                  <Badge variant="success">Complete</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
        Projects
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
          title="Could not load projects"
          description={
            error instanceof Error
              ? error.message
              : "Make sure the backend is running at localhost:8000"
          }
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          }
          title="No projects yet"
          description="Create your first project to start analyzing customer feedback."
          action={
            <Button onClick={() => setShowCreateProject(true)}>
              Create your first project
            </Button>
          }
        />
      )}

      <CreateProjectDialog
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
