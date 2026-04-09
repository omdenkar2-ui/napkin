"use client";

import {
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

type Source = "slack" | "intercom" | "zoom" | "typeform" | "notion" | "email" | "spreadsheet" | "manual";
type Sentiment = "positive" | "neutral" | "negative";

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

interface FeedbackRowProps {
  id: string;
  source: Source;
  content: string;
  customerName?: string;
  sentiment: Sentiment;
  createdAt: string;
  selected: boolean;
  onClick: () => void;
}

export function FeedbackRow({
  source,
  content,
  customerName,
  sentiment,
  createdAt,
  selected,
  onClick,
}: FeedbackRowProps) {
  const SourceIcon = SOURCE_ICONS[source];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className={cn(
        "flex items-center h-[52px] px-5 border-b border-[--border]/60 hover:bg-[--surface-alt]/50 cursor-pointer transition-colors duration-100",
        selected && "bg-[--primary-soft]/60 border-l-2 border-l-[--primary]",
      )}
    >
      {/* Checkbox placeholder */}
      <div className="w-4 h-4 border border-[--border] rounded-sm shrink-0 mr-3" />

      {/* Source icon */}
      <SourceIcon className="w-4 h-4 text-[--text-muted] shrink-0 mr-3" />

      {/* Content snippet */}
      <span className="text-[13px] text-[--text-secondary] truncate flex-1 min-w-0">
        {content}
      </span>

      {/* Customer name */}
      <span className="text-[12px] text-[--text-muted] w-32 truncate text-right shrink-0 mx-3">
        {customerName || "Anonymous"}
      </span>

      {/* Sentiment badge */}
      <span
        className={cn(
          "text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 capitalize",
          sentiment === "positive" && "bg-[#E6F7EF] text-[#166534]",
          sentiment === "neutral" && "bg-[--surface-alt] text-[--text-secondary]",
          sentiment === "negative" && "bg-[#FEE2E2] text-[#991B1B]",
        )}
      >
        {sentiment}
      </span>

      {/* Date */}
      <span className="text-[12px] text-[--text-muted] w-20 text-right shrink-0 ml-3">
        {createdAt}
      </span>
    </div>
  );
}
