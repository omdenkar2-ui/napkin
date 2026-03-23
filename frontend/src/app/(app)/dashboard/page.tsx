"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProjectCard } from "@/components/dashboard/project-card";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { listProjects } from "@/lib/api/projects";

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

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
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
