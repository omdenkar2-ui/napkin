"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sendChatMessage, getChatHistory, type ChatMessage, type DataSummary } from "@/lib/api/chat";
import { Spinner } from "@/components/ui/spinner";
import { SendHorizontal, MessageSquare, Database } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface NapkinChatProps {
  projectId: string;
}

export function NapkinChat({ projectId }: NapkinChatProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["chat-history", projectId],
    queryFn: () => getChatHistory(projectId),
  });

  const [optimisticMessages, setOptimisticMessages] = useState<
    Array<{ role: string; content: string; data_summary?: DataSummary | null }>
  >([]);

  const sendMutation = useMutation({
    mutationFn: (message: string) => sendChatMessage(projectId, message),
    onMutate: (message) => {
      setOptimisticMessages((prev) => [
        ...prev,
        { role: "user", content: message },
      ]);
    },
    onSuccess: (response) => {
      setOptimisticMessages((prev) => [
        ...prev,
        { role: response.role, content: response.content, data_summary: response.data_summary },
      ]);
      queryClient.invalidateQueries({ queryKey: ["chat-history", projectId] });
    },
    onError: () => {
      setOptimisticMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    },
  });

  // Reset optimistic messages when history reloads
  useEffect(() => {
    if (history.length > 0) {
      setOptimisticMessages([]);
    }
  }, [history]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, optimisticMessages, sendMutation.isPending]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const allMessages: Array<{ role: string; content: string; id?: string; data_summary?: DataSummary | null }> = [
    ...history.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
      id: m.id,
      data_summary: (m.metadata as Record<string, unknown>)?.data_summary as DataSummary | undefined,
    })),
    ...optimisticMessages.map((m, i) => ({
      ...m,
      id: `opt-${i}`,
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {historyLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="md" className="text-text-tertiary" />
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-card-bg border border-border flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-text-ghost" />
            </div>
            <p className="text-[15px] font-medium text-foreground mb-1">
              Ask Napkin anything
            </p>
            <p className="text-[13px] text-text-tertiary max-w-[300px]">
              Ask Napkin anything about your feedback, patterns, or product
              decisions.
            </p>
          </div>
        ) : (
          allMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-white text-black rounded-br-md"
                    : "bg-card-bg border border-border text-foreground rounded-bl-md"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <>
                    <div className="prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:bg-[rgba(255,255,255,0.1)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_pre]:bg-[rgba(255,255,255,0.05)] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.data_summary && (msg.data_summary.sessions_searched > 0 || msg.data_summary.feedback_items_searched > 0) && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                        <Database className="w-3 h-3 text-text-ghost" />
                        <span className="text-[11px] text-text-ghost">
                          Searched {msg.data_summary.sessions_searched} session{msg.data_summary.sessions_searched !== 1 ? "s" : ""}
                          {msg.data_summary.feedback_items_searched > 0 && `, ${msg.data_summary.feedback_items_searched} feedback items`}
                          {msg.data_summary.specs_found > 0 && `, ${msg.data_summary.specs_found} specs`}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-card-bg border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 bg-card-bg border border-border rounded-xl px-3 py-2 focus-within:border-border-focus transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Napkin anything about your feedback..."
              rows={1}
              className="w-full resize-none bg-transparent text-[13px] text-foreground placeholder:text-text-tertiary outline-none max-h-[120px]"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || sendMutation.isPending}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white text-black hover:bg-[rgba(255,255,255,0.9)] transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default NapkinChat;
