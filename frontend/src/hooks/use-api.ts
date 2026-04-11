import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSessions,
  getSession,
  createSession,
  sendMessage,
  addFeedback,
  uploadFeedbackFile,
  deleteSession,
  retrySession,
} from "@/lib/api/sessions";
import { sendChatMessage, getChatHistory } from "@/lib/api/chat";
import type {
  Session,
  SessionListItem,
  SessionCreate,
  DashboardStats,
  PlatformTask,
  Workflow,
  Integration,
  WorkspaceMember,
  ActivityItem,
} from "@/types/api";

// ============================================
// SESSIONS — Connected to real backend
// ============================================

export function useSessions(projectId: string | null) {
  return useQuery<SessionListItem[]>({
    queryKey: ["sessions", projectId],
    queryFn: () => listSessions(projectId!),
    enabled: !!projectId,
  });
}

export function useSession(id: string) {
  return useQuery<Session>({
    queryKey: ["session", id],
    queryFn: () => getSession(id),
    enabled: !!id,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (data.stage === "done" || data.stage === "error") return false;
      return 3000;
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SessionCreate) => createSession(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useRetrySession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => retrySession(sessionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["session", data.session_id] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

// ============================================
// SESSION FEEDBACK — Connected to real backend
// ============================================

export function useAddFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, texts, sourceLabel }: { sessionId: string; texts: string[]; sourceLabel?: string }) =>
      addFeedback(sessionId, texts, sourceLabel),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ["session", vars.sessionId] }),
  });
}

export function useUploadFeedbackFile() {
  return useMutation({
    mutationFn: ({ projectId, file }: { projectId: string; file: File }) =>
      uploadFeedbackFile(projectId, file),
  });
}

// ============================================
// SESSION CHAT — Connected to real backend
// ============================================

export function useSessionChat(sessionId: string) {
  return useMutation({
    mutationFn: (content: string) => sendMessage(sessionId, content),
  });
}

// ============================================
// PROJECT-LEVEL CHAT — Connected to real backend
// ============================================

export function useChatHistory(projectId: string | null) {
  return useQuery({
    queryKey: ["chat-history", projectId],
    queryFn: () => getChatHistory(projectId!),
    enabled: !!projectId,
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { project_id: string; message: string; session_id?: string }) =>
      sendChatMessage(data.project_id, data.message, data.session_id),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ["chat-history", vars.project_id] }),
  });
}

// ============================================
// DASHBOARD — No backend endpoint yet
// ============================================
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => Promise.reject("No backend endpoint"),
    enabled: false,
  });
}

export function useActivityFeed() {
  return useQuery<ActivityItem[]>({
    queryKey: ["activity"],
    queryFn: () => Promise.reject("No backend endpoint"),
    enabled: false,
  });
}

// ============================================
// TASKS — No dedicated backend endpoint yet
// Tasks live inside session.task_plan / spec_object
// ============================================
export function useTasks(filters?: { status?: string; priority?: string; assignee?: string }) {
  return useQuery<PlatformTask[]>({
    queryKey: ["tasks", filters],
    queryFn: () => Promise.reject("No backend endpoint"),
    enabled: false,
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (_data: { id: string }) => Promise.reject("No backend endpoint") as Promise<void>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useSendTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (_data: { task_ids: string[]; destination: string }) =>
      Promise.reject("No backend endpoint") as Promise<void>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

// ============================================
// WORKFLOWS — No backend endpoint yet
// ============================================
export function useWorkflows() {
  return useQuery<Workflow[]>({
    queryKey: ["workflows"],
    queryFn: () => Promise.reject("No backend endpoint"),
    enabled: false,
  });
}

export function useWorkflow(id: string) {
  return useQuery<Workflow>({
    queryKey: ["workflow", id],
    queryFn: () => Promise.reject("No backend endpoint"),
    enabled: false,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (_data: unknown) => Promise.reject("No backend endpoint") as Promise<void>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

// ============================================
// INTEGRATIONS — No backend endpoint yet
// (Real endpoints exist at /api/v1/integrations
// but need project_id and different shapes)
// ============================================
export function useIntegrations() {
  return useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => Promise.reject("No backend endpoint"),
    enabled: false,
  });
}

export function useConnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (_type: string) => Promise.reject("No backend endpoint") as Promise<void>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useSyncIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (_id: string) => Promise.reject("No backend endpoint") as Promise<void>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

// ============================================
// TEAM — No backend endpoint yet
// ============================================
export function useTeamMembers() {
  return useQuery<WorkspaceMember[]>({
    queryKey: ["team"],
    queryFn: () => Promise.reject("No backend endpoint"),
    enabled: false,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (_data: unknown) => Promise.reject("No backend endpoint") as Promise<void>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}
