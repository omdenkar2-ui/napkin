"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { FeedbackInput } from "./feedback-input";
import { QuestionAnswerForm } from "./question-answer-form";
import { ProcessingIndicator } from "./processing-indicator";
import { isAutoAdvanceStage } from "@/types/session";
import type { Message, SessionStage } from "@/types/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface SessionChatProps {
  messages: Message[];
  stage: SessionStage;
  questions: string[];
  isComplete: boolean;
  sessionId: string;
  onSendFeedback: (texts: string[]) => void;
  onSendMessage: (content: string) => void;
  sending: boolean;
}

export function SessionChat({
  messages,
  stage,
  questions,
  isComplete,
  sessionId,
  onSendFeedback,
  onSendMessage,
  sending,
}: SessionChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && stage === "intake" && (
          <div className="text-center py-12">
            <p className="font-serif text-xl text-foreground mb-2">
              Ready to analyze feedback
            </p>
            <p className="text-sm text-muted">
              Paste customer feedback below to get started.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {isAutoAdvanceStage(stage) && !isComplete && (
          <ProcessingIndicator stage={stage} />
        )}

        {isComplete && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm mb-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Session complete
            </div>
            <div className="flex items-center justify-center gap-3">
              <Link href={`/sessions/${sessionId}/spec`}>
                <Button variant="secondary" size="sm">View Spec</Button>
              </Link>
              <Link href={`/sessions/${sessionId}/exports`}>
                <Button variant="secondary" size="sm">Exports</Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-4">
        {stage === "intake" && !isComplete && (
          <FeedbackInput onSubmit={onSendFeedback} loading={sending} />
        )}

        {(stage === "four_questions" || stage === "spec_qa") &&
          questions.length > 0 && (
            <QuestionAnswerForm
              questions={questions}
              onSubmit={onSendMessage}
              loading={sending}
            />
          )}

        {stage === "error" && (
          <div className="text-center py-4">
            <p className="text-sm text-destructive">
              An error occurred. Please try sending your message again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
