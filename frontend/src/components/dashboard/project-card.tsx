"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";
import type { Project } from "@/types/api";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:border-accent/30 transition-colors cursor-pointer">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-foreground">{project.name}</h3>
            {project.description && (
              <p className="text-sm text-muted mt-1 line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
          <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted">
          <span>Updated {formatRelative(project.updated_at)}</span>
          {project.repo_url && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.364-9.364a4.5 4.5 0 00-6.364 6.364L7.5 8.25l4.5-4.5a4.5 4.5 0 016.364 0z" />
              </svg>
              Repo linked
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
