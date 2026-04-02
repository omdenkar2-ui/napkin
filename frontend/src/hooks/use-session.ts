"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSession,
  sendMessage,
  addFeedback,
} from "@/lib/api/sessions";
import { ApiError } from "@/lib/api/client";
import { STAGES } from "@/types/session";
import { toast } from "sonner";

const STAGE_LABELS: Record<string, string> = {
  intake: "Processing your feedback...",
  synthesis: "Finding patterns across your feedback...",
  prioritization: "Ranking opportunities...",
  four_questions: "Analyzing strategic context...",
  repo_context: "Reviewing your codebase...",
  spec_building: "Building recommendations...",
  spec_qa: "Running quality checks...",
  task_planning: "Creating action plan...",
  review: "Reviewing results...",
  done: "Analysis complete",
  error: "Something went wrong",
};

const SLOW_STAGES = ["synthesis", "spec_building", "task_planning"];

export function useSession(sessionId: string) {
  const [sending, setSending] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const autoSkippedStages = useRef<Set<string>>(new Set());

  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getSession(sessionId),
    staleTime: 0,
    gcTime: 0,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return false;
      return failureCount < 2;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (data.stage === "done" || data.stage === "error") return false;
      if (SLOW_STAGES.includes(data.stage)) return 5000;
      return 2000;
    },
  });

  // Pipeline runs fully automatically — no auto-skip needed
  // Keep the effect structure in case we add interactive stages later
  useEffect(() => {
    if (!session) return;
    void autoSkippedStages; // suppress unused warning
  }, [session, sessionId, sending, queryClient]);

  const isProcessing =
    !!session && session.stage !== "done" && session.stage !== "error";

  const userFacingStatus = session
    ? STAGE_LABELS[session.stage] || "Processing..."
    : "Loading...";

  const stageIndex = session
    ? STAGES.findIndex((s) => s.key === session.stage)
    : -1;
  const progressPct =
    stageIndex === -1 ? 0 : Math.round((stageIndex / (STAGES.length - 2)) * 100); // -2 to exclude done+error

  const handleSendFeedback = useCallback(
    async (texts: string[]) => {
      setSending(true);
      try {
        const result = await addFeedback(sessionId, texts);
        setQuestions(result.questions || []);
        queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      } catch {
        toast.error("Failed to send feedback");
      } finally {
        setSending(false);
      }
    },
    [sessionId, queryClient],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      setSending(true);
      try {
        const result = await sendMessage(sessionId, content);
        setQuestions(result.questions || []);
        queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      } catch {
        toast.error("Failed to send message");
      } finally {
        setSending(false);
      }
    },
    [sessionId, queryClient],
  );

  const currentQuestions = questions.length > 0 ? questions : [];

  return {
    session,
    isLoading,
    error,
    sending,
    isProcessing,
    userFacingStatus,
    progressPct,
    questions: currentQuestions,
    handleSendFeedback,
    handleSendMessage,
  };
}
