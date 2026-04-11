"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getOrCreateDefaultProject } from "@/lib/api/projects";
import type { Project } from "@/types/api";

interface ProjectContextType {
  project: Project | null;
  projectId: string | null;
  loading: boolean;
  error: string | null;
}

const ProjectContext = createContext<ProjectContextType>({
  project: null,
  projectId: null,
  loading: true,
  error: null,
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const p = await getOrCreateDefaultProject();
        if (!cancelled) {
          setProject(p);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load project");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        project,
        projectId: project?.id ?? null,
        loading,
        error,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
