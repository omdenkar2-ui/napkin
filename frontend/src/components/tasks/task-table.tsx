"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskRow } from "./task-row";

type Priority = "p0" | "p1" | "p2" | "p3";
type Status = "pending" | "approved" | "sent" | "discarded";

interface Task {
  id: string;
  title: string;
  assignee: { id: string; name: string } | null;
  priority: Priority;
  status: Status;
  source_theme: string;
  evidence_count: number;
}

interface TaskTableProps {
  tasks: Task[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onOpenDetail: (id: string) => void;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
}

export function TaskTable({
  tasks,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpenDetail,
  onApprove,
  onDiscard,
}: TaskTableProps) {
  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id));

  return (
    <div className="bg-[--surface] border border-[--border] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-11 px-5 bg-[--surface-alt]">
        <div className="w-10 shrink-0">
          <button
            type="button"
            onClick={onSelectAll}
            className={cn(
              "w-4 h-4 border rounded-sm flex items-center justify-center transition-colors",
              allSelected
                ? "bg-[--primary] border-[--primary] text-white"
                : "border-[--border] hover:border-[--border-strong]",
            )}
          >
            {allSelected && <Check className="w-3 h-3" />}
          </button>
        </div>
        <span className="w-16 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] shrink-0">Priority</span>
        <span className="flex-1 min-w-[300px] text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Task</span>
        <span className="w-40 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] shrink-0">Assignee</span>
        <span className="w-44 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] shrink-0">Source</span>
        <span className="w-24 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] shrink-0">Evidence</span>
        <span className="w-28 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] shrink-0">Status</span>
        <span className="w-24 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] shrink-0 text-right">Actions</span>
      </div>

      {/* Rows */}
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          id={task.id}
          title={task.title}
          assignee={task.assignee}
          priority={task.priority}
          status={task.status}
          sourceTheme={task.source_theme}
          evidenceCount={task.evidence_count}
          checked={selectedIds.has(task.id)}
          onCheck={onToggleSelect}
          onOpenDetail={onOpenDetail}
          onApprove={onApprove}
          onDiscard={onDiscard}
        />
      ))}
    </div>
  );
}
