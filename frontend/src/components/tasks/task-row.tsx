"use client";

import { Check, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "p0" | "p1" | "p2" | "p3";
type Status = "pending" | "approved" | "sent" | "discarded";

interface Assignee {
  id: string;
  name: string;
}

interface TaskRowProps {
  id: string;
  title: string;
  assignee: Assignee | null;
  priority: Priority;
  status: Status;
  sourceTheme: string;
  evidenceCount: number;
  checked: boolean;
  onCheck: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  p0: "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]",
  p1: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]",
  p2: "bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE]",
  p3: "bg-[--surface-alt] text-[--text-muted] border border-[--border]",
};

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]",
  approved: "bg-[#E6F7EF] text-[#166534] border border-[#BBF7D0]",
  sent: "bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE]",
  discarded: "bg-[--surface-alt] text-[--text-muted] border border-[--border]",
};

const AVATAR_COLORS = [
  { bg: "bg-[#E8F4F6]", text: "text-[#1B6B7A]" },
  { bg: "bg-[#E6F7EF]", text: "text-[#166534]" },
  { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function TaskRow({
  id,
  title,
  assignee,
  priority,
  status,
  sourceTheme,
  evidenceCount,
  checked,
  onCheck,
  onOpenDetail,
  onApprove,
  onDiscard,
}: TaskRowProps) {
  const avatarColor = assignee ? getAvatarColor(assignee.name) : null;

  return (
    <div
      className={cn(
        "flex items-center min-h-[52px] px-5 border-b border-[--border]/60 last:border-0 hover:bg-[--surface-alt]/50 transition-colors duration-100",
        checked && "bg-[--primary-soft]/30",
      )}
    >
      {/* Checkbox */}
      <div className="w-10 shrink-0">
        <button
          type="button"
          onClick={() => onCheck(id)}
          className={cn(
            "w-4 h-4 border rounded-sm flex items-center justify-center transition-colors",
            checked
              ? "bg-[--primary] border-[--primary] text-white"
              : "border-[--border] hover:border-[--border-strong]",
          )}
        >
          {checked && <Check className="w-3 h-3" />}
        </button>
      </div>

      {/* Priority */}
      <div className="w-16 shrink-0">
        <span className={cn("text-[11px] font-semibold w-7 h-5 inline-flex items-center justify-center rounded-md", PRIORITY_STYLES[priority])}>
          {priority.toUpperCase()}
        </span>
      </div>

      {/* Task title */}
      <div className="flex-1 min-w-[300px] pr-3">
        <button
          type="button"
          onClick={() => onOpenDetail(id)}
          className="text-left flex items-center gap-1.5"
        >
          <Sparkles className="w-2.5 h-2.5 text-[--info] shrink-0" />
          <span className="text-[13px] font-medium text-[--text-primary] truncate hover:underline">
            {title}
          </span>
        </button>
      </div>

      {/* Assignee */}
      <div className="w-40 shrink-0 flex items-center gap-2">
        {assignee && avatarColor ? (
          <>
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0", avatarColor.bg, avatarColor.text)}>
              {getInitials(assignee.name)}
            </div>
            <span className="text-[12px] text-[--text-secondary] truncate">{assignee.name}</span>
          </>
        ) : (
          <span className="text-[12px] text-[--text-muted]">Unassigned</span>
        )}
      </div>

      {/* Source */}
      <div className="w-44 shrink-0">
        <span className="text-[12px] text-[--primary] hover:underline cursor-pointer truncate block">
          {sourceTheme}
        </span>
      </div>

      {/* Evidence */}
      <div className="w-24 shrink-0">
        <span className="text-[12px] text-[--text-muted]" title={`Based on ${evidenceCount} feedback items`}>
          {evidenceCount} items
        </span>
      </div>

      {/* Status */}
      <div className="w-28 shrink-0">
        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize", STATUS_STYLES[status])}>
          {status}
        </span>
      </div>

      {/* Actions */}
      <div className="w-24 shrink-0 flex justify-end gap-1">
        {status === "pending" && (
          <>
            <button
              type="button"
              onClick={() => onApprove(id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#22A06B] hover:bg-[#E6F7EF] transition-colors duration-100"
              title="Approve"
              aria-label="Approve task"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDiscard(id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[--text-muted] hover:bg-[#FEE2E2] hover:text-[#991B1B] transition-colors duration-100"
              title="Discard"
              aria-label="Discard task"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
