"use client";

import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Priority = "p0" | "p1" | "p2" | "p3";

interface TaskSummary {
  id: string;
  title: string;
  priority: Priority;
}

interface SendConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tasks: TaskSummary[];
}

const PRIORITY_STYLES: Record<Priority, string> = {
  p0: "bg-[--error-soft] text-[--error-text]",
  p1: "bg-[--warning-soft] text-[--warning-text]",
  p2: "bg-[--info-soft] text-[--info-text]",
  p3: "bg-[--surface-alt] text-[--text-muted]",
};

export function SendConfirmationModal({ open, onClose, onConfirm, tasks }: SendConfirmationModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogTitle>Send {tasks.length} tasks to Linear?</DialogTitle>
      <DialogDescription className="text-[13px] text-[--text-muted]">
        This will create {tasks.length} issues in your Linear project.
      </DialogDescription>

      <div className="mt-4 border border-[--border] rounded-md max-h-[240px] overflow-y-auto">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-2 py-2 px-3",
              index < tasks.length - 1 && "border-b border-[--border]",
              index % 2 === 1 && "bg-[--surface-alt]/50",
            )}
          >
            <span className={cn("text-[11px] font-medium w-7 h-5 inline-flex items-center justify-center rounded-full shrink-0", PRIORITY_STYLES[task.priority])}>
              {task.priority.toUpperCase()}
            </span>
            <span className="text-[13px] text-[--text-primary] truncate">{task.title}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 rounded-md border border-[--border] text-sm font-medium text-[--text-secondary] hover:bg-[--surface-hover] hover:border-[--border-strong] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-9 px-4 rounded-md bg-[--primary] text-[--primary-text] text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          Send {tasks.length} Tasks
        </button>
      </div>
    </Dialog>
  );
}
