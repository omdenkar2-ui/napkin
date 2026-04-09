"use client";

import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Hash,
  MessageCircle,
  Video,
  FileText,
  BookOpen,
  Mail,
  Table,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowSource = "slack" | "intercom" | "zoom" | "typeform" | "notion" | "email" | "spreadsheet" | "manual";

const SOURCE_ICONS: Record<WorkflowSource, LucideIcon> = {
  slack: Hash,
  intercom: MessageCircle,
  zoom: Video,
  typeform: FileText,
  notion: BookOpen,
  email: Mail,
  spreadsheet: Table,
  manual: PenLine,
};

export interface Workflow {
  id: string;
  name: string;
  sources: WorkflowSource[];
  schedule: string;
  last_run: string | null;
  status: "active" | "paused";
}

interface WorkflowTableProps {
  workflows: Workflow[];
}

export function WorkflowTable({ workflows }: WorkflowTableProps) {
  const router = useRouter();

  return (
    <div className="bg-[--surface] border border-[--border] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-11 px-5 bg-[--surface-alt]">
        <span className="flex-1 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Name</span>
        <span className="w-40 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Sources</span>
        <span className="w-44 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Schedule</span>
        <span className="w-32 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Last Run</span>
        <span className="w-24 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Status</span>
        <span className="w-20 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em] text-right">Actions</span>
      </div>

      {/* Rows */}
      {workflows.map((wf, index) => (
        <div
          key={wf.id}
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/workflows/${wf.id}`)}
          onKeyDown={(e) => { if (e.key === "Enter") router.push(`/workflows/${wf.id}`); }}
          className={cn(
            "flex items-center h-[52px] px-5 hover:bg-[--surface-alt]/50 cursor-pointer transition-colors duration-100",
            index < workflows.length - 1 && "border-b border-[--border]/60",
          )}
        >
          {/* Name */}
          <span className="flex-1 text-[14px] font-medium text-[--text-primary] truncate">
            {wf.name}
          </span>

          {/* Sources */}
          <div className="w-40 flex items-center gap-1.5">
            {wf.sources.slice(0, 3).map((src) => {
              const Icon = SOURCE_ICONS[src];
              return <Icon key={src} className="w-4 h-4 text-[--text-muted]" />;
            })}
            {wf.sources.length > 3 && (
              <span className="text-[11px] text-[--text-muted]">+{wf.sources.length - 3}</span>
            )}
          </div>

          {/* Schedule */}
          <span className="w-44 text-[13px] text-[--text-secondary]">{wf.schedule}</span>

          {/* Last Run */}
          <span className="w-32 text-[12px] text-[--text-muted]">{wf.last_run ?? "Never"}</span>

          {/* Status */}
          <div className="w-24">
            <span
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                wf.status === "active" && "bg-[#E6F7EF] text-[#166534] border border-[#BBF7D0]",
                wf.status === "paused" && "bg-[--surface-alt] text-[--text-muted] border border-[--border]",
              )}
            >
              {wf.status === "active" ? "Active" : "Paused"}
            </span>
          </div>

          {/* Actions */}
          <div className="w-20 flex justify-end">
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:bg-[--surface-alt] transition-colors duration-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
