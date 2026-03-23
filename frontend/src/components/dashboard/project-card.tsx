"use client";

import Link from "next/link";
import { formatRelative } from "@/lib/utils";
import type { Project } from "@/types/api";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/sessions?project=${project.id}`}
      className="block bg-surface border border-border rounded-xl p-4 hover:border-muted transition-colors"
    >
      <h3 className="text-sm text-foreground font-medium truncate">
        {project.name}
      </h3>
      {project.description && (
        <p className="text-xs text-muted mt-1 line-clamp-2">
          {project.description}
        </p>
      )}
      <div className="flex items-center gap-3 mt-3">
        <span className="text-xs text-muted">
          {formatRelative(project.updated_at)}
        </span>
        {project.repo_url && (
          <span className="text-xs text-muted flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            Linked
          </span>
        )}
      </div>
    </Link>
  );
}
