"use client";

import { useMemo, useState } from "react";
import { SessionCard } from "./session-card";
import { SessionsSortFilter } from "./sessions-sort-filter";
import type { SessionCardSession } from "./session-card";

interface SessionsGridProps {
  sessions: SessionCardSession[];
  onSessionClick: (id: string) => void;
  onNewSession: () => void;
  onEmojiChange: (id: string, emoji: string) => void;
  onDelete: (id: string) => void;
}

function EmptyState({ onNewSession }: { onNewSession: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="text-[48px]">📋</div>
      <p className="text-[17px] font-medium text-[rgba(255,255,255,0.80)]">No sessions yet</p>
      <p className="text-[14px] text-[rgba(255,255,255,0.38)] text-center max-w-[260px]">
        Run your first session to start turning raw feedback into a spec.
      </p>
      <button
        onClick={onNewSession}
        className="mt-2 bg-white text-black text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[rgba(255,255,255,0.90)] transition-colors"
      >
        + New session
      </button>
    </div>
  );
}

export function SessionsGrid({
  sessions,
  onSessionClick,
  onNewSession,
  onEmojiChange,
  onDelete,
}: SessionsGridProps) {
  const [sortBy, setSortBy] = useState<"most_recent" | "oldest" | "title_az" | "title_za">("most_recent");
  const [filterStatus, setFilterStatus] = useState<"all" | "spec_ready" | "processing" | "patterns_ready" | "archived" | "no_patterns">("all");

  const filteredAndSorted = useMemo(() => {
    let result = [...sessions];

    if (filterStatus !== "all") {
      result = result.filter((s) => {
        if (filterStatus === "spec_ready")     return ["spec_ready", "completed", "ready"].includes(s.status);
        if (filterStatus === "processing")     return ["processing", "in_review", "review"].includes(s.status);
        if (filterStatus === "archived")       return ["archived", "archive"].includes(s.status);
        return s.status === filterStatus;
      });
    }

    if (sortBy === "most_recent") result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortBy === "oldest")      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortBy === "title_az")    result.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "title_za")    result.sort((a, b) => b.title.localeCompare(a.title));

    return result;
  }, [sessions, sortBy, filterStatus]);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-[1100px] mx-auto px-8 py-10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[28px] font-semibold text-[rgba(255,255,255,0.92)] tracking-tight">
            Sessions
          </h1>
          <button
            onClick={onNewSession}
            className="flex items-center gap-1.5 bg-white text-black text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.90)] transition-colors"
          >
            <span className="text-[16px] leading-none">+</span>
            New session
          </button>
        </div>

        {/* Sort/filter bar — only when there are sessions */}
        {sessions.length > 0 && (
          <SessionsSortFilter
            sortBy={sortBy}
            filterStatus={filterStatus}
            onSortChange={setSortBy}
            onFilterChange={setFilterStatus}
            totalCount={sessions.length}
            filteredCount={filteredAndSorted.length}
          />
        )}

        {/* Grid, filtered-empty, or full empty state */}
        {sessions.length === 0 ? (
          <EmptyState onNewSession={onNewSession} />
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-[15px] font-medium text-[rgba(255,255,255,0.60)]">No sessions match this filter</p>
            <button
              onMouseDown={() => setFilterStatus("all")}
              className="text-[13px] text-[rgba(255,255,255,0.38)] hover:text-[rgba(255,255,255,0.70)] transition-colors underline underline-offset-2"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAndSorted.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onSessionClick(session.id)}
                onEmojiChange={onEmojiChange}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
