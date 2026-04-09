"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  ArrowUp,
  Paperclip,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const MOCK_AI_RESPONSES: ChatMessage[] = [
  {
    id: "cycle-1",
    role: "assistant",
    content: "That's a great question. Based on the data in this session, I can see that this pattern appears across multiple sources. The highest concentration is from Slack feedback (67%) followed by Intercom (28%). Would you like me to break this down further?",
    timestamp: "Just now",
  },
  {
    id: "cycle-2",
    role: "assistant",
    content: "I've looked at the sentiment trends for this area. Overall sentiment has declined 15% over the past 2 weeks, with the most negative feedback coming from power users. This suggests it's affecting your most engaged customers.",
    timestamp: "Just now",
  },
  {
    id: "cycle-3",
    role: "assistant",
    content: "Here's what I'd recommend based on the patterns: focus on the top 3 issues first, as they account for 62% of all negative feedback. Shall I generate specific tasks with acceptance criteria?",
    timestamp: "Just now",
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "system-1",
    role: "system",
    content: "",
    timestamp: "",
  },
  {
    id: "user-1",
    role: "user",
    content: "Which patterns are most critical to address first?",
    timestamp: "2 min ago",
  },
  {
    id: "ai-1",
    role: "assistant",
    content: "Based on severity and frequency, I'd prioritize these three patterns:\n\n1. **Mobile app performance issues** — 23 mentions, mostly negative sentiment. Users report crashes during photo uploads, affecting ~23% of mobile users.\n\n2. **CSV export errors** — 3 mentions but all P0 severity. Complete feature breakage.\n\n3. **Notification overload** — 11 mentions, growing trend. Users feel spammed.\n\nWould you like me to generate tasks for any of these?",
    timestamp: "2 min ago",
  },
  {
    id: "user-2",
    role: "user",
    content: "Generate tasks for mobile performance",
    timestamp: "1 min ago",
  },
  {
    id: "ai-2",
    role: "assistant",
    content: "Here are 3 suggested tasks for the mobile performance pattern:",
    tasks: [
      { title: "Fix photo upload crash on iOS 17+", priority: "P0" },
      { title: "Optimize app launch time", priority: "P1" },
      { title: "Add upload progress indicator", priority: "P2" },
    ],
    timestamp: "1 min ago",
  },
];

const SUGGESTION_CHIPS = [
  "Why is mobile performance the top pattern?",
  "Compare sentiment across sources",
  "Generate tasks for critical patterns",
];

export function SessionChat({ sessionId, dataPointCount }: SessionChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const responseIndexRef = useRef(0);

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

  const sendMessage = useCallback((text: string) => {
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

    setTimeout(() => {
      const idx = responseIndexRef.current % MOCK_AI_RESPONSES.length;
      responseIndexRef.current += 1;
      const aiMsg: ChatMessage = {
        ...MOCK_AI_RESPONSES[idx],
        id: `ai-${Date.now()}`,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
    if (e.key === "Escape") {
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "40px";
      }
    }
  }

  const canSend = inputValue.trim().length > 0;

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
                      onClick={() => sendMessage(chip)}
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
                        <button
                          type="button"
                          onClick={() => console.log("add task:", task.title)}
                          className="text-[12px] font-medium text-[#1B6B7A] hover:underline cursor-pointer mt-1"
                        >
                          Add to tasks &rarr;
                        </button>
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
            onClick={() => sendMessage(inputValue)}
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
            onClick={() => console.log("upload file")}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#999999] hover:text-[#4A4A4A] transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Upload file
          </button>
          <button
            type="button"
            onClick={() => console.log("generate tasks")}
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
