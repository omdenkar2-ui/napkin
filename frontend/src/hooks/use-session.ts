"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSession,
  sendMessage,
  addFeedback,
} from "@/lib/api/sessions";
import type { SessionStage } from "@/types/api";
import { toast } from "sonner";

const STAGE_LABELS: Record<string, string> = {
  intake: "Uploading your feedback...",
  synthesis: "Finding patterns across your feedback...",
  prioritization: "Ranking opportunities...",
  four_questions: "Analyzing context...",
  repo_context: "Reviewing your codebase...",
  spec_building: "Building recommendations...",
  spec_qa: "Running quality checks...",
  task_planning: "Creating action plan...",
  export: "Preparing results...",
  done: "Analysis complete",
  error: "Something went wrong",
};

// Pipeline now runs automatically — no stages need skipping
const AUTO_SKIP_STAGES: SessionStage[] = [];

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
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (data.stage === "done" || data.stage === "error") return false;
      return 3000;
    },
  });

  // Auto-skip interactive stages
  useEffect(() => {
    if (!session) return;
    const stage = session.stage as SessionStage;
    if (
      AUTO_SKIP_STAGES.includes(stage) &&
      !autoSkippedStages.current.has(stage) &&
      !sending
    ) {
      autoSkippedStages.current.add(stage);
      sendMessage(sessionId, "Continue with your best judgment").then(() => {
        queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      });
    }
  }, [session, sessionId, sending, queryClient]);

  const isProcessing =
    !!session && session.stage !== "done" && session.stage !== "error";

  const userFacingStatus = session
    ? STAGE_LABELS[session.stage] || "Processing..."
    : "Loading...";

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

  const currentQuestions =
    questions.length > 0 ? questions : [];

  return {
    session,
    isLoading,
    error,
    sending,
    isProcessing,
    userFacingStatus,
    questions: currentQuestions,
    handleSendFeedback,
    handleSendMessage,
  };
}
