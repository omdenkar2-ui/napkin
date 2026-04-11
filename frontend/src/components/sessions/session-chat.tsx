"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  ArrowUp,
  Paperclip,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage } from "@/lib/api/sessions";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tasks?: { title: string; priority: string }[];
  timestamp: string;
}

interface SessionChatProps {
  sessionId: string;
  dataPointCount: number;
}

const SUGGESTION_CHIPS = [
  "What are the most critical patterns?",
  "Which user segment is most affected?",
  "What should we build first?",
];

export function SessionChat({ sessionId, dataPointCount }: SessionChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "system-1",
      role: "system",
      content: "",
      timestamp: "",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  function autoGrowTextarea() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "40px";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: "Just now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
    setIsTyping(true);

    try {
      const response = await sendMessage(sessionId, text.trim());
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: response.agent_message,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process that request. Please try again.",
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [sessionId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
    if (e.key === "Escape") {
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "40px";
      }
    }
  }

  const canSend = inputValue.trim().length > 0 && !isTyping;

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 min-h-0">
        {messages.map((msg) => {
          if (msg.role === "system") {
            return (
              <div key={msg.id} className="bg-[#F5F3EF] rounded-xl p-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#1B6B7A]" />
                  <span className="text-[12px] font-semibold text-[#1B6B7A]">AI Assistant</span>
                </div>
                <p className="text-[13px] text-[#4A4A4A] mt-2 leading-relaxed">
                  I&apos;ve analyzed {dataPointCount} data points from this session. I can help you understand the patterns, dive deeper into specific areas, or generate tasks. Try asking me something like:
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSendMessage(chip)}
                      className="border border-[#E5E2DC] rounded-lg px-3 py-1.5 text-xs font-medium text-[#4A4A4A] cursor-pointer hover:border-[#1B6B7A] hover:text-[#1B6B7A] hover:bg-[#E8F4F6]/30 transition-all duration-150"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end mb-4">
                <div className="bg-[#1B6B7A] text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%]">
                  <p className="text-[13px] leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          }

          // Assistant message
          return (
            <div key={msg.id} className="flex justify-start mb-4">
              <div className="w-6 h-6 rounded-full bg-[#E8F4F6] flex items-center justify-center shrink-0 mt-1 mr-2">
                <Sparkles className="w-3 h-3 text-[#1B6B7A]" />
              </div>
              <div className="bg-[#F5F3EF] text-[#4A4A4A] rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[85%]">
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
                  {renderMarkdownBold(msg.content)}
                </div>
                {msg.tasks && msg.tasks.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    {msg.tasks.map((task) => (
                      <div
                        key={task.title}
                        className="border border-[#E5E2DC] rounded-lg p-3 bg-white"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#1A1A1A]">{task.title}</span>
                          <span className="text-[11px] font-semibold text-[#999999] shrink-0">{task.priority}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start mb-4">
            <div className="w-6 h-6 rounded-full bg-[#E8F4F6] flex items-center justify-center shrink-0 mt-1 mr-2">
              <Sparkles className="w-3 h-3 text-[#1B6B7A]" />
            </div>
            <div className="bg-[#F5F3EF] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#999999] animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#999999] animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#999999] animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[#E5E2DC] pt-3 pb-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              autoGrowTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about patterns, request tasks, or paste data..."
            rows={1}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none border border-[#E5E2DC] rounded-xl px-4 py-2.5 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[#1B6B7A] focus:ring-1 focus:ring-[#1B6B7A]/20 focus:outline-none transition-colors"
          />
          <button
            type="button"
            disabled={!canSend}
            onClick={() => handleSendMessage(inputValue)}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0",
              canSend
                ? "bg-[#1B6B7A] hover:bg-[#16596A] cursor-pointer"
                : "bg-[#E5E2DC] cursor-not-allowed",
            )}
          >
            <ArrowUp className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#999999] hover:text-[#4A4A4A] transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Upload file
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#999999] hover:text-[#4A4A4A] transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Generate tasks
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple renderer for **bold** markdown syntax in message text */
function renderMarkdownBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-[#1A1A1A]">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
