import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DashboardStats,
  PlatformSession,
  PlatformTask,
  Workflow,
  Integration,
  WorkspaceMember,
  ActivityItem,
  ChatMessage,
  CreatePlatformSessionRequest,
  UpdateTaskRequest,
  SendTasksRequest,
  InviteMemberRequest,
  CreateWorkflowRequest,
  SendChatMessageRequest,
} from "@/types/api";

// ============================================
// BASE API CLIENT
// Replace this URL with your actual backend URL
// ============================================
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ============================================
// DASHBOARD
// ============================================
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiFetch("/api/dashboard/stats"),
    enabled: false, // TODO: enable when backend is ready
  });
}

export function useActivityFeed() {
  return useQuery<ActivityItem[]>({
    queryKey: ["activity"],
    queryFn: () => apiFetch("/api/activity"),
    enabled: false,
  });
}

// ============================================
// SESSIONS
// ============================================
export function useSessions() {
  return useQuery<PlatformSession[]>({
    queryKey: ["sessions"],
    queryFn: () => apiFetch("/api/sessions"),
    enabled: false,
  });
}

export function useSession(id: string) {
  return useQuery<PlatformSession>({
    queryKey: ["session", id],
    queryFn: () => apiFetch(`/api/sessions/${id}`),
    enabled: false,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlatformSessionRequest) =>
      apiFetch("/api/sessions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

// ============================================
// SESSION CHAT
// ============================================
export function useSessionChat(sessionId: string) {
  return useQuery<ChatMessage[]>({
    queryKey: ["session-chat", sessionId],
    queryFn: () => apiFetch(`/api/sessions/${sessionId}/chat`),
    enabled: false,
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SendChatMessageRequest) =>
      apiFetch(`/api/sessions/${data.session_id}/chat`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ["session-chat", vars.session_id] }),
  });
}

// ============================================
// TASKS
// ============================================
export function useTasks(filters?: { status?: string; priority?: string; assignee?: string }) {
  return useQuery<PlatformTask[]>({
    queryKey: ["tasks", filters],
    queryFn: () => apiFetch(`/api/tasks?${new URLSearchParams(filters as Record<string, string>)}`),
    enabled: false,
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTaskRequest & { id: string }) =>
      apiFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useSendTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SendTasksRequest) =>
      apiFetch("/api/tasks/send", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

// ============================================
// WORKFLOWS
// ============================================
export function useWorkflows() {
  return useQuery<Workflow[]>({
    queryKey: ["workflows"],
    queryFn: () => apiFetch("/api/workflows"),
    enabled: false,
  });
}

export function useWorkflow(id: string) {
  return useQuery<Workflow>({
    queryKey: ["workflow", id],
    queryFn: () => apiFetch(`/api/workflows/${id}`),
    enabled: false,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkflowRequest) =>
      apiFetch("/api/workflows", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

// ============================================
// INTEGRATIONS
// ============================================
export function useIntegrations() {
  return useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => apiFetch("/api/integrations"),
    enabled: false,
  });
}

export function useConnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: string) =>
      apiFetch("/api/integrations/connect", { method: "POST", body: JSON.stringify({ type }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useSyncIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/integrations/${id}/sync`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

// ============================================
// TEAM
// ============================================
export function useTeamMembers() {
  return useQuery<WorkspaceMember[]>({
    queryKey: ["team"],
    queryFn: () => apiFetch("/api/team"),
    enabled: false,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteMemberRequest) =>
      apiFetch("/api/team/invite", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

// ============================================
// FILE UPLOAD
// ============================================
export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Upload error: ${res.status}`);
      return res.json();
    },
  });
}
