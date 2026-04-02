"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSessions, deleteSession } from "@/lib/api/sessions";
import { getOrCreateDefaultProject } from "@/lib/api/projects";
import { Spinner } from "@/components/ui/spinner";
import { SessionsGrid } from "@/components/sessions/sessions-grid";
import type { SessionCardSession } from "@/components/sessions/session-card";
import type { SessionListItem, SessionStage } from "@/types/api";

const LS_EMOJI_KEY = "napkin-session-emojis";

function deriveCardStatus(stage: SessionStage): SessionCardSession["status"] {
  if (stage === "done") return "spec_ready";
  if (stage === "error") return "no_patterns";
  if (
    stage === "spec_building" ||
    stage === "spec_qa" ||
    stage === "task_planning" ||
    stage === "review"
  ) {
    return "patterns_ready";
  }
  return "processing";
}

function deriveSessionTitle(session: SessionListItem): string {
  if (session.title && !session.title.startsWith("Session ")) return session.title;
  return "Untitled session";
}

function loadEmojiMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_EMOJI_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export default function SessionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [emojiMap, setEmojiMap] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEmojiMap(loadEmojiMap());
  }, []);

  useEffect(() => {
    getOrCreateDefaultProject()
      .then((p) => setProjectId(p.id))
      .catch(() => router.push("/setup"));
  }, [router]);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions", projectId],
    queryFn: () => listSessions(projectId!, 100, 0),
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  function handleEmojiChange(id: string, emoji: string) {
    const updated = { ...emojiMap, [id]: emoji };
    setEmojiMap(updated);
    try {
      localStorage.setItem(LS_EMOJI_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  }

  async function handleDelete(id: string) {
    setDeletedIds((prev) => new Set(prev).add(id));
    try {
      await deleteSession(id);
      queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
    } catch (err) {
      console.error("Failed to delete session:", err);
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (!projectId || isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  const cardSessions: SessionCardSession[] = (sessions ?? [])
    .filter((s) => !deletedIds.has(s.id))
    .map((s) => ({
      id: s.id,
      title: deriveSessionTitle(s),
      emoji: emojiMap[s.id] ?? "📋",
      status: deriveCardStatus(s.stage),
      feedbackCount: 0,
      createdAt: s.created_at,
    }));

  return (
    <SessionsGrid
      sessions={cardSessions}
      onSessionClick={(id) => router.push(`/s/${id}`)}
      onNewSession={() => router.push("/new")}
      onEmojiChange={handleEmojiChange}
      onDelete={handleDelete}
    />
  );
}
