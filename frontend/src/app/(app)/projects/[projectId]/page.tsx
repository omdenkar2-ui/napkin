"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "@/lib/api/projects";
import { listSessions } from "@/lib/api/sessions";
import { SessionCard } from "@/components/project/session-card";
import { CreateSessionDialog } from "@/components/project/create-session-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [showCreate, setShowCreate] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });

  const {
    data: sessions,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["sessions", projectId],
    queryFn: () => listSessions(projectId),
  });

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-2">
        <Link
          href="/dashboard"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          &larr; Projects
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foreground">
            {project?.name || "Project"}
          </h1>
          {project?.description && (
            <p className="text-sm text-muted mt-1">{project.description}</p>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)}>New session</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          }
          title="No sessions yet"
          description="Start a session to analyze customer feedback and generate specs."
          action={
            <Button onClick={() => setShowCreate(true)}>
              Start your first session
            </Button>
          }
        />
      )}

      <CreateSessionDialog
        projectId={projectId}
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          refetch();
        }}
      />
    </div>
  );
}
