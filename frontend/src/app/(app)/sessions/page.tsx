"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listSessions } from "@/lib/api/sessions";
import { getOrCreateDefaultProject } from "@/lib/api/projects";
import { Spinner } from "@/components/ui/spinner";
import { formatRelative } from "@/lib/utils";
import type { SessionListItem, SessionStage } from "@/types/api";

const STAGE_LABELS: Partial<Record<SessionStage, string>> = {
  intake: "Processing...",
  synthesis: "Analyzing...",
  prioritization: "Ranking...",
  four_questions: "Context...",
  spec_building: "Building...",
  task_planning: "Planning...",
};

function groupSessionsByDate(sessions: SessionListItem[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  const thisMonthStart = new Date(today);
  thisMonthStart.setMonth(thisMonthStart.getMonth() - 1);

  const groups: Record<string, SessionListItem[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    "This Month": [],
    Older: [],
  };

  for (const s of sessions) {
    const d = new Date(s.created_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today) groups["Today"].push(s);
    else if (day >= yesterday) groups["Yesterday"].push(s);
    else if (d >= thisWeekStart) groups["This Week"].push(s);
    else if (d >= thisMonthStart) groups["This Month"].push(s);
    else groups["Older"].push(s);
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

export default function SessionsPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  if (!projectId || isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  const allSessions = sessions ?? [];
  const filtered = search.trim()
    ? allSessions.filter((s) =>
        (s.title ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : allSessions;

  const completedCount = allSessions.filter((s) => s.stage === "done").length;
  const processingCount = allSessions.filter(
    (s) => s.stage !== "done" && s.stage !== "error",
  ).length;

  return (
    <div className="max-w-[800px] p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
          {allSessions.length > 0 && (
            <p className="text-[13px] text-text-tertiary mt-2">
              {completedCount} completed · {processingCount} processing ·{" "}
              {allSessions.length} total
            </p>
          )}
        </div>
        <Link
          href="/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-cta-bg text-cta-text text-[13px] font-medium"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New session
        </Link>
      </div>

      {/* Search */}
      {allSessions.length >= 3 && (
        <div className="relative mb-6">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.675 6.675a7.5 7.5 0 0 0 9.975 9.975z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full h-10 bg-card-bg border border-border rounded-lg pl-10 pr-4 text-sm text-foreground placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
          />
        </div>
      )}

      {/* Session list or empty state */}
      {allSessions.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-[16px] font-medium text-foreground">
            No sessions yet
          </p>
          <p className="text-[14px] text-text-secondary mt-2">
            Analyze customer feedback to see sessions here.
          </p>
          <Link
            href="/new"
            className="inline-flex items-center mt-6 h-10 px-5 bg-cta-bg text-cta-text rounded-lg text-[13px] font-medium"
          >
            Start new session →
          </Link>
        </div>
      ) : (
        <div>
          {groupSessionsByDate(filtered).map(([heading, items], groupIdx) => (
            <div key={heading} className={groupIdx === 0 ? "mt-0" : "mt-6"}>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-ghost mb-2">
                {heading}
              </h2>
              <div>
                {items.map((s) => (
                  <Link
                    key={s.id}
                    href={`/s/${s.id}`}
                    className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-card-bg transition-colors border-b border-[rgba(255,255,255,0.04)] last:border-0"
                  >
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-foreground truncate">
                        {s.title ||
                          `Analysis from ${formatRelative(s.created_at)}`}
                      </p>
                      <p className="text-[12px] text-text-tertiary mt-1">
                        {formatRelative(s.created_at)}
                      </p>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {s.stage === "done" ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-accent-green" />
                          <span className="text-[12px] text-text-tertiary">
                            Complete
                          </span>
                        </>
                      ) : s.stage === "error" ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-accent-red" />
                          <span className="text-[12px] text-text-tertiary">
                            Error
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-white/50 animate-pulse" />
                          <span className="text-[12px] text-text-secondary">
                            {STAGE_LABELS[s.stage] ?? "Processing..."}
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
