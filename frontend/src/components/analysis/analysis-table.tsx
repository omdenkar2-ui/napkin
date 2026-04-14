"use client";

import { useRouter } from "next/navigation";
import {
  Hash,
  MessageCircle,
  Video,
  FileText,
  BookOpen,
  Mail,
  Table,
  PenLine,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Source = "slack" | "intercom" | "zoom" | "typeform" | "notion" | "email" | "spreadsheet" | "manual";
type Status = "completed" | "processing" | "failed";

const SOURCE_ICONS: Record<Source, LucideIcon> = {
  slack: Hash,
  intercom: MessageCircle,
  zoom: Video,
  typeform: FileText,
  notion: BookOpen,
  email: Mail,
  spreadsheet: Table,
  manual: PenLine,
};

const STATUS_STYLES: Record<Status, string> = {
  completed: "bg-[#E6F7EF] text-[#166534] border border-[#BBF7D0]",
  processing: "bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE] animate-pulse",
  failed: "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]",
};

export interface AnalysisRow {
  id: string;
  date: string;
  time: string;
  sources: Source[];
  feedbackCount: string;
  themesFound: string;
  status: Status;
}

interface AnalysisTableProps {
  analyses: AnalysisRow[];
  onDelete?: (id: string) => void;
}

export function AnalysisTable({ analyses, onDelete }: AnalysisTableProps) {
  const router = useRouter();

  return (
    <div className="bg-[--surface] border border-[--border] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-11 px-5 bg-[--surface-alt]">
        <span className="w-40 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Date</span>
        <span className="flex-1 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Name</span>
        <span className="w-44 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Sources</span>
        <span className="w-28 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Data Points</span>
        <span className="w-28 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Patterns</span>
        <span className="w-28 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Status</span>
        {onDelete && <span className="w-10" />}
      </div>

      {/* Rows */}
      {analyses.map((row, index) => (
        <div
          key={row.id}
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/sessions/${row.id}`)}
          onKeyDown={(e) => { if (e.key === "Enter") router.push(`/sessions/${row.id}`); }}
          className={cn(
            "flex items-center h-[52px] px-5 hover:bg-[--surface-alt]/50 cursor-pointer transition-colors duration-100",
            index < analyses.length - 1 && "border-b border-[--border]/60",
          )}
        >
          {/* Date */}
          <div className="w-40">
            <span className="block text-[14px] text-[--text-primary]">{row.date}</span>
            {row.time && <span className="block text-[11px] text-[--text-muted]">{row.time}</span>}
          </div>

          {/* Name */}
          <span className="flex-1 text-[14px] font-medium text-[--text-primary] truncate">{row.date}</span>

          {/* Sources */}
          <div className="w-44 flex items-center gap-1.5">
            {row.sources.map((src) => {
              const Icon = SOURCE_ICONS[src];
              return <Icon key={src} className="w-4 h-4 text-[--text-muted]" />;
            })}
          </div>

          {/* Data Points */}
          <span className="w-28 text-[14px] font-medium text-[--text-primary]">{row.feedbackCount}</span>

          {/* Patterns */}
          <span className="w-28 text-[14px] font-medium text-[--text-primary]">{row.themesFound}</span>

          {/* Status */}
          <div className="w-28">
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize", STATUS_STYLES[row.status])}>
              {row.status}
            </span>
          </div>

          {/* Delete */}
          {onDelete && (
            <div className="w-10 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(row.id);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:text-red-600 hover:bg-red-50 transition-colors"
                aria-label={`Delete ${row.date}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
