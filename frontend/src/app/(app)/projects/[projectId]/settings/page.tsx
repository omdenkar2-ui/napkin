"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "@/lib/api/projects";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", params.projectId],
    queryFn: () => getProject(params.projectId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-2">
        <Link
          href={`/projects/${params.projectId}`}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          &larr; Back to project
        </Link>
      </div>
      <h1 className="font-serif text-2xl text-foreground mb-6">
        Project Settings
      </h1>

      <div className="space-y-6">
        <Card>
          <CardTitle>Details</CardTitle>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted">Name</label>
              <p className="text-sm text-foreground">{project?.name}</p>
            </div>
            <div>
              <label className="text-xs text-muted">Description</label>
              <p className="text-sm text-foreground">
                {project?.description || "No description"}
              </p>
            </div>
            {project?.repo_url && (
              <div>
                <label className="text-xs text-muted">Repository</label>
                <p className="text-sm text-foreground">{project.repo_url}</p>
              </div>
            )}
            <div>
              <label className="text-xs text-muted">Project ID</label>
              <p className="text-xs text-muted font-mono">{project?.id}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
