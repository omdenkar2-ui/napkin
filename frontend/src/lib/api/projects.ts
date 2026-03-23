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
  return api.put<Project>(`/projects/${projectId}`, data);
}

export async function deleteProject(projectId: string): Promise<void> {
  return api.delete(`/projects/${projectId}`);
}
