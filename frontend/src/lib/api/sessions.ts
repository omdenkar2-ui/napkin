import { api } from "./client";
import type {
  Session,
  SessionCreate,
  SessionListItem,
  SessionMessageResponse,
  ExportData,
} from "@/types/api";

export async function listSessions(
  projectId: string,
  limit = 20,
  offset = 0,
): Promise<SessionListItem[]> {
  return api.get<SessionListItem[]>(
    `/sessions?project_id=${projectId}&limit=${limit}&offset=${offset}`,
  );
}

export async function getSession(sessionId: string): Promise<Session> {
  return api.get<Session>(`/sessions/${sessionId}`);
}

export async function createSession(
  data: SessionCreate,
): Promise<SessionMessageResponse> {
  return api.post<SessionMessageResponse>("/sessions", data);
}

export async function sendMessage(
  sessionId: string,
  content: string,
): Promise<SessionMessageResponse> {
  return api.post<SessionMessageResponse>(`/sessions/${sessionId}/message`, {
    content,
  });
}

export async function addFeedback(
  sessionId: string,
  texts: string[],
  sourceLabel?: string,
): Promise<SessionMessageResponse> {
  return api.post<SessionMessageResponse>(`/sessions/${sessionId}/feedback`, {
    texts,
    source_label: sourceLabel,
  });
}

export async function uploadRepoFiles(
  sessionId: string,
  files: Record<string, string>,
): Promise<{ session_id: string; files_received: number; message: string }> {
  return api.post(`/sessions/${sessionId}/repo-files`, { files });
}

export async function getSessionSpec(
  sessionId: string,
): Promise<Record<string, unknown>> {
  return api.get(`/sessions/${sessionId}/spec`);
}

export async function getCursorPrompt(
  sessionId: string,
): Promise<{ session_id: string; prompt: string }> {
  return api.get(`/sessions/${sessionId}/cursor-prompt`);
}

export async function getSprintPlan(
  sessionId: string,
): Promise<{ session_id: string; sprint_plan: Record<string, unknown> }> {
  return api.get(`/sessions/${sessionId}/sprint-plan`);
}

export async function getPrioritization(
  sessionId: string,
): Promise<{
  session_id: string;
  prioritization: Record<string, unknown>;
}> {
  return api.get(`/sessions/${sessionId}/prioritization`);
}

export async function getExports(
  sessionId: string,
): Promise<ExportData> {
  return api.get<ExportData>(`/sessions/${sessionId}/exports`);
}

export async function getExportTickets(
  sessionId: string,
): Promise<unknown[]> {
  return api.get(`/sessions/${sessionId}/exports/tickets`);
}

export async function getExportPrd(
  sessionId: string,
): Promise<{ prd_url: string; expires_in: string }> {
  return api.get(`/sessions/${sessionId}/exports/prd`);
}

export async function uploadFeedbackFile(
  projectId: string,
  file: File,
): Promise<{ id: string; filename: string; items_extracted: number }> {
  return api.upload("/feedback/upload", file, { project_id: projectId });
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/sessions/${id}`);
}

export async function pasteFeedback(
  projectId: string,
  texts: string[],
): Promise<{ items_created: number }> {
  return api.post("/feedback/paste", {
    project_id: projectId,
    texts,
  });
}
