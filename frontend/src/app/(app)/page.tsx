"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getOrCreateDefaultProject } from "@/lib/api/projects";
import { createSession, listSessions } from "@/lib/api/sessions";
import { formatRelative } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/providers/auth-provider";
import {
  FeedbackInput,
  type FeedbackInputRef,
} from "@/components/feedback/feedback-input";
import type { SessionListItem } from "@/types/api";

const SAMPLE_FEEDBACK = `The search functionality is really slow when I have more than 50 items in my list. Takes 3-4 seconds every time.

I wish I could export my data to CSV. I've been manually copying rows for weeks now.

Would love a dark mode option. The bright white is hard on my eyes when working late.

Notifications keep coming even after I've marked things as read. Super annoying, happens every day.`;

function sessionTitle(session: SessionListItem): string {
  return session.title ?? `Analysis from ${formatRelative(session.created_at)}`;
}

function isProcessing(session: SessionListItem): boolean {
  return session.stage !== "done" && session.stage !== "error";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const feedbackRef = useRef<FeedbackInputRef>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    getOrCreateDefaultProject()
      .then((p) => {
        setProjectId(p.id);
        setInitializing(false);
      })
      .catch(() => router.replace("/setup"));
  }, [router]);

  const { data: sessions } = useQuery({
    queryKey: ["sessions", projectId],
    queryFn: () => listSessions(projectId!, 5, 0),
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const handleSubmit = async (texts: string[]) => {
    if (!projectId) {
      toast.error("Not ready yet");
      return;
    }
    if (texts.length === 0) {
      toast.error("No feedback found");
      return;
    }
    try {
      const result = await createSession({
        project_id: projectId,
        initial_feedback: { texts },
      });
      router.push(`/s/${result.session_id}`);
    } catch {
      toast.error("Failed to start analysis");
      throw new Error("submit failed");
    }
  };

  const sessionList = sessions ?? [];
  const hasAnySessions = sessionList.length > 0;

  const userName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.user_metadata?.name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    null;

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-[600px] flex flex-col items-center">

        {/* Greeting */}
        <h1 className="text-[28px] font-medium text-foreground tracking-[-0.02em] text-center mb-8">
          {hasAnySessions
            ? userName ? `Hello again, ${userName}` : "Hello again"
            : "Welcome to Napkin"}
        </h1>

        {/* Input card */}
        <FeedbackInput
          ref={feedbackRef}
          onSubmit={handleSubmit}
          minTextareaHeight="80px"
          placeholder="Paste customer feedback to discover patterns..."
        />

        {/* Suggestion chips */}
        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => feedbackRef.current?.openFilePicker()}
            className="px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[12px] text-text-tertiary hover:text-text-secondary hover:border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer"
          >
            Upload CSV
          </button>
          <button
            type="button"
            onClick={() => feedbackRef.current?.focusTextarea()}
            className="px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[12px] text-text-tertiary hover:text-text-secondary hover:border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer"
          >
            Paste interview notes
          </button>
          <button
            type="button"
            onClick={() => feedbackRef.current?.fillText(SAMPLE_FEEDBACK)}
            className="px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[12px] text-text-tertiary hover:text-text-secondary hover:border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer"
          >
            Try with sample data
          </button>
        </div>

        {/* No sessions helper */}
        {!hasAnySessions && (
          <p className="text-[13px] text-text-ghost text-center mt-8">
            Turn customer feedback into evidence-backed specs.
          </p>
        )}

        {/* Recent sessions */}
        {hasAnySessions && (
          <div className="w-full mt-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-ghost mb-3">
              Recent
            </p>
            <div>
              {sessionList.map((session) => (
                <Link
                  key={session.id}
                  href={`/s/${session.id}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                >
                  <span className="text-sm text-foreground truncate flex-1 min-w-0">
                    {sessionTitle(session)}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <span className="text-xs text-text-ghost">
                      {formatRelative(session.created_at)}
                    </span>
                    {session.stage === "done" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                    )}
                    {session.stage === "error" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                    )}
                    {isProcessing(session) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
            {sessionList.length >= 5 && (
              <div className="mt-2 text-center">
                <Link
                  href="/sessions"
                  className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  View all →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
