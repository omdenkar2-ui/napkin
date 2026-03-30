import { api } from "./client";

export interface SpecListItem {
  id: string;
  session_id: string;
  project_id: string;
  decision: { what?: string; why?: string } | null;
  status: string;
  cursor_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export async function listSpecs(
  projectId: string,
  status?: string,
  limit = 50,
): Promise<SpecListItem[]> {
  let path = `/specs?project_id=${projectId}&limit=${limit}`;
  if (status) path += `&status_filter=${status}`;
  return api.get<SpecListItem[]>(path);
}

export async function getSpec(specId: string): Promise<SpecListItem> {
  return api.get<SpecListItem>(`/specs/${specId}`);
}

export async function updateSpecStatus(
  specId: string,
  status: "draft" | "review" | "approved" | "shipped" | "abandoned",
): Promise<SpecListItem> {
  return api.patch<SpecListItem>(`/specs/${specId}/status`, { status });
}

export async function recordSpecOutcome(
  specId: string,
  shipped: boolean,
  outcomeNotes?: string,
): Promise<SpecListItem> {
  return api.patch<SpecListItem>(`/specs/${specId}/outcome`, {
    shipped,
    outcome_notes: outcomeNotes || null,
  });
}
