"use client";

import { motion } from "motion/react";
import { X, Hash, MessageCircle, Video, FileText, BookOpen, Mail, Table, PenLine, type LucideIcon } from "lucide-react";
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

const SOURCE_LABELS: Record<Source, string> = {
  slack: "Slack",
  intercom: "Intercom",
  zoom: "Zoom",
  typeform: "Typeform",
  notion: "Notion",
  email: "Email",
  spreadsheet: "Spreadsheets",
  manual: "Manual",
};

interface FeedbackDetailPanelProps {
  item: {
    id: string;
    source: Source;
    content: string;
    customer_name?: string;
    customer_email?: string;
    sentiment: Sentiment;
    tags: string[];
    created_at: string;
    source_channel?: string;
  };
  onClose: () => void;
}

export function FeedbackDetailPanel({ item, onClose }: FeedbackDetailPanelProps) {
  const SourceIcon = SOURCE_ICONS[item.source];

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="w-[420px] border-l border-[--border] bg-[--surface] h-full overflow-y-auto shrink-0 shadow-xl relative">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-[--text-muted] hover:bg-[--surface-alt] transition-colors duration-150"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="p-6 border-b border-[--border]/60">
        <h3 className="text-[16px] font-semibold text-[--text-primary]">Feedback Detail</h3>
      </div>

      {/* Full content */}
      <div className="p-6">
        <p className="text-[14px] text-[--text-secondary] leading-relaxed whitespace-pre-wrap">
          {item.content}
        </p>

        {/* Metadata */}
        <div className="mt-6 pt-5 border-t border-[--border]/60">
          <MetadataRow label="Source">
            <div className="flex items-center gap-1.5">
              <SourceIcon className="w-3.5 h-3.5 text-[--text-muted]" />
              <span className="text-[13px] text-[--text-primary]">
                {SOURCE_LABELS[item.source]}
                {item.source_channel && ` ${item.source_channel}`}
              </span>
            </div>
          </MetadataRow>

          <MetadataRow label="Customer">
            <span className="text-[13px] text-[--text-primary]">
              {item.customer_name || "Anonymous"}
              {item.customer_email && (
                <span className="text-[--text-muted] ml-1">({item.customer_email})</span>
              )}
            </span>
          </MetadataRow>

          <MetadataRow label="Date">
            <span className="text-[13px] text-[--text-primary]">{item.created_at}</span>
          </MetadataRow>

          <MetadataRow label="Sentiment" last>
            <span
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize",
                item.sentiment === "positive" && "bg-[#E6F7EF] text-[#166534]",
                item.sentiment === "neutral" && "bg-[--surface-alt] text-[--text-secondary]",
                item.sentiment === "negative" && "bg-[#FEE2E2] text-[#991B1B]",
              )}
            >
              {item.sentiment}
            </span>
          </MetadataRow>
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-[--surface-alt] text-[--text-secondary] text-xs px-2 py-0.5 rounded-md border border-[--border]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => console.log("archive", item.id)}
            className="w-full h-9 px-4 border border-[--border] rounded-lg text-sm font-medium text-[--text-secondary] hover:bg-[--surface-alt] hover:border-[--border-strong] transition-all duration-150"
          >
            Archive
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MetadataRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-2", !last && "border-b border-[--border]/60")}>
      <span className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em]">{label}</span>
      {children}
    </div>
  );
}
