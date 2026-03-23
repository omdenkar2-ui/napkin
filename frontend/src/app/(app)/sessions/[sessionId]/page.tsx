"use client";

import { useParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { SessionChat } from "@/components/session/session-chat";
import { SessionPipeline } from "@/components/session/session-pipeline";
import { ArtifactPanel } from "@/components/session/artifact-panel";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { getStageInfo } from "@/types/session";
import Link from "next/link";

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const {
    session,
    isLoading,
    sending,
    questions,
    handleSendFeedback,
    handleSendMessage,
  } = useSession(sessionId);

  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const stageInfo = getStageInfo(session.stage);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${session.project_id}`}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="font-medium text-foreground truncate">
            {session.title || "Untitled session"}
          </h1>
          <Badge
            variant={
              session.stage === "done"
                ? "success"
                : session.stage === "error"
                  ? "error"
                  : "accent"
            }
          >
            {stageInfo?.label || session.stage}
          </Badge>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <SessionChat
            messages={session.messages || []}
            stage={session.stage}
            questions={questions}
            isComplete={session.status === "completed" || session.stage === "done"}
            sessionId={sessionId}
            onSendFeedback={handleSendFeedback}
            onSendMessage={handleSendMessage}
            sending={sending}
          />
        </div>

        {/* Right panel — Pipeline + Artifacts */}
        <div className="w-64 border-l border-border p-4 flex flex-col gap-6 overflow-y-auto flex-shrink-0">
          <SessionPipeline currentStage={session.stage} />
          <ArtifactPanel session={session} />
        </div>
      </div>
    </div>
  );
}
