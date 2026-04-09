"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { X, Sparkles, Hash, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "p0" | "p1" | "p2" | "p3";
type Status = "pending" | "approved" | "sent" | "discarded";

const PRIORITY_STYLES: Record<Priority, string> = {
  p0: "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]",
  p1: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]",
  p2: "bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE]",
  p3: "bg-[--surface-alt] text-[--text-muted] border border-[--border]",
};

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];

interface TaskDetailPanelProps {
  task: {
    id: string;
    title: string;
    description: string;
    assignee: { id: string; name: string } | null;
    priority: Priority;
    status: Status;
    source_theme: string;
    evidence_count: number;
    labels: string[];
  };
  onClose: () => void;
  onApprove: (id: string) => void;
  onDiscard: (id: string) => void;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const MOCK_FEEDBACK = [
  { source: "slack" as const, content: "The mobile app crashes every time I try to upload a photo. This has been happening since the last update.", customer: "Sarah Chen" },
  { source: "intercom" as const, content: "Photo upload is broken on iOS. Multiple users reporting the same issue.", customer: "Support Team" },
  { source: "slack" as const, content: "Can't upload images on my iPhone anymore. Worked fine last week.", customer: "James Brown" },
];

const SOURCE_ICONS = {
  slack: Hash,
  intercom: MessageCircle,
} as const;

export function TaskDetailPanel({ task, onClose, onApprove, onDiscard }: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="w-[420px] border-l border-[--border] bg-[--surface] h-full overflow-y-auto shrink-0 p-6 shadow-xl relative">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:bg-[--surface-alt] transition-colors duration-150"
      >
        <X className="w-4 h-4" />
      </button>

      {/* AI badge */}
      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE] text-[11px] font-medium rounded-md px-2.5 py-0.5">
          <Sparkles className="w-[13px] h-[13px]" />
          AI Generated
        </span>
      </div>

      {/* Editable title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-[16px] font-semibold text-[--text-primary] bg-transparent border-0 border-b border-transparent focus:border-[--border] outline-none pb-1 mb-3 transition-colors"
      />

      {/* Editable description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full text-[13px] text-[--text-secondary] leading-relaxed bg-transparent border-0 border border-transparent focus:border-[--border] rounded-lg outline-none min-h-[120px] resize-none p-1 transition-colors"
      />

      {/* Metadata */}
      <div className="mt-6 flex flex-col gap-4">
        {/* Assignee */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-1">Assignee</label>
          <div className="flex items-center gap-2">
            {task.assignee ? (
              <>
                <div className="w-8 h-8 rounded-full bg-[#E8F4F6] text-[#1B6B7A] flex items-center justify-center text-[12px] font-semibold">
                  {getInitials(task.assignee.name)}
                </div>
                <span className="text-[13px] text-[--text-primary]">{task.assignee.name}</span>
              </>
            ) : (
              <span className="text-[13px] text-[--text-muted]">Unassigned</span>
            )}
            <button type="button" className="text-[12px] font-medium text-[--primary] hover:underline ml-auto">Change</button>
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-1">Priority</label>
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "text-[11px] font-semibold w-8 h-6 rounded-md flex items-center justify-center transition-colors",
                  PRIORITY_STYLES[p],
                  priority === p && "ring-2 ring-[--border-focus] ring-offset-1",
                )}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-1">Labels</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.labels.map((label) => (
              <span key={label} className="bg-[--surface-alt] text-[--text-secondary] text-[11px] px-2 py-0.5 rounded-md border border-[--border]">{label}</span>
            ))}
            <button type="button" className="text-[11px] font-medium text-[--primary] hover:underline">+ Add</button>
          </div>
        </div>

        {/* Source */}
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-1">Source</label>
          <button type="button" className="text-[13px] font-medium text-[--primary] hover:underline">{task.source_theme}</button>
          <p className="text-[12px] text-[--text-muted] mt-0.5">Based on {task.evidence_count} feedback items</p>
        </div>
      </div>

      {/* Supporting feedback */}
      <div className="mt-6 pt-5 border-t border-[--border]/60">
        <h4 className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-3">Supporting Feedback</h4>
        {MOCK_FEEDBACK.map((fb, i) => {
          const Icon = SOURCE_ICONS[fb.source];
          return (
            <div key={i} className="bg-[--surface-alt] rounded-lg p-3 mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3 text-[--text-muted]" />
              </div>
              <p className="text-[12px] text-[--text-secondary] line-clamp-2">{fb.content}</p>
              <p className="text-[11px] text-[--text-muted] mt-1">{fb.customer}</p>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="mt-6 pt-5 border-t border-[--border]/60 flex gap-3">
        <button
          type="button"
          onClick={() => console.log("regenerate", task.id)}
          className="inline-flex items-center gap-1.5 h-9 px-3 border border-[--border] rounded-lg text-[13px] font-medium text-[--text-secondary] hover:bg-[--surface-alt] hover:border-[--border-strong] transition-all duration-150"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Regenerate
        </button>
        <button
          type="button"
          onClick={() => onDiscard(task.id)}
          className="h-9 px-3 rounded-lg text-[13px] font-medium text-[--error] hover:bg-[--error-soft] transition-colors"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => onApprove(task.id)}
          className="flex-1 h-9 px-4 rounded-lg bg-[--primary] text-[--primary-text] text-[13px] font-medium hover:bg-[--primary-hover] transition-colors"
        >
          Approve
        </button>
      </div>
    </motion.div>
  );
}
