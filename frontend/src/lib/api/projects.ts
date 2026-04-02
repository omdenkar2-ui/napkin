import { api } from "./client";
import type { Project, ProjectCreate } from "@/types/api";

export async function listProjects(): Promise<Project[]> {
  return api.get<Project[]>("/projects");
}

export async function getProject(projectId: string): Promise<Project> {
  return api.get<Project>(`/projects/${projectId}`);
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  return api.post<Project>("/projects", data);
}

export async function updateProject(
  projectId: string,
  data: Partial<ProjectCreate>,
): Promise<Project> {
  return api.patch<Project>(`/projects/${projectId}`, data);
}

export async function deleteProject(projectId: string): Promise<void> {
  return api.delete(`/projects/${projectId}`);
}

const DEFAULT_PROJECT_KEY = "napkin_default_project_id";

export async function getOrCreateDefaultProject(): Promise<Project> {
  const cachedId = localStorage.getItem(DEFAULT_PROJECT_KEY);
  if (cachedId) {
    try {
      const project = await getProject(cachedId);
      return project;
    } catch {
      localStorage.removeItem(DEFAULT_PROJECT_KEY);
    }
  }

  const projects = await listProjects();
  if (projects.length > 0) {
    localStorage.setItem(DEFAULT_PROJECT_KEY, projects[0].id);
    return projects[0];
  }

  const newProject = await createProject({
    name: "My Workspace",
    description: "Default workspace for feedback analysis",
  });
  localStorage.setItem(DEFAULT_PROJECT_KEY, newProject.id);
  return newProject;
}
