"use client";

import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import type { Message } from "@/types/api";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-[8px] px-4 py-3",
          isUser
            ? "bg-accent/20 text-foreground"
            : "bg-surface text-foreground border border-border",
        )}
      >
        <div className="text-sm prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.timestamp && (
          <p className="text-[10px] text-muted mt-2">
            {formatTime(message.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
