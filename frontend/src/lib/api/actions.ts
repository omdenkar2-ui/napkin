import { api } from "./client";

export interface GeneratedAction {
  id: string;
  action_type: string;
  title: string;
  content: string;
  status: string;
  external_url?: string;
  created_at: string;
}

export async function generateActions(
  sessionId: string,
  projectId: string,
): Promise<GeneratedAction[]> {
  return api.post<GeneratedAction[]>("/actions/generate", {
    session_id: sessionId,
    project_id: projectId,
  });
}

export async function listActions(
  sessionId: string,
): Promise<GeneratedAction[]> {
  return api.get<GeneratedAction[]>(
    `/actions?session_id=${sessionId}`,
  );
}

export async function sendAction(
  actionId: string,
  projectId: string,
): Promise<{ status: string; external_url?: string }> {
  return api.post<{ status: string; external_url?: string }>(
    `/actions/${actionId}/send`,
    { project_id: projectId },
  );
}
