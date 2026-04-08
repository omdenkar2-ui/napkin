import { api } from "./client";

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface DataSummary {
  sessions_searched: number;
  feedback_items_searched: number;
  specs_found: number;
  decisions_found: number;
}

export interface ChatResponse {
  role: string;
  content: string;
  metadata: Record<string, unknown>;
  data_summary?: DataSummary | null;
}

export async function sendChatMessage(
  projectId: string,
  message: string,
  sessionId?: string,
): Promise<ChatResponse> {
  return api.post<ChatResponse>("/chat", {
    project_id: projectId,
    message,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

export async function getChatHistory(
  projectId: string,
  limit?: number,
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ project_id: projectId });
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }
  return api.get<ChatMessage[]>(`/chat/history?${params.toString()}`);
}
