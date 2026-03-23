"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSession,
  sendMessage,
  addFeedback,
} from "@/lib/api/sessions";
import { isAutoAdvanceStage } from "@/types/session";
import { toast } from "sonner";

export function useSession(sessionId: string) {
  const [sending, setSending] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getSession(sessionId),
    refetchInterval: (query) => {
      const stage = query.state.data?.stage;
      if (!stage) return false;
      // Poll during auto-advance stages
      if (isAutoAdvanceStage(stage)) return 3000;
      return false;
    },
  });

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

  // Derive questions from session data if not set from latest response
  const currentQuestions =
    questions.length > 0 ? questions : [];

  return {
    session,
    isLoading,
    error,
    sending,
    questions: currentQuestions,
    handleSendFeedback,
    handleSendMessage,
  };
}
