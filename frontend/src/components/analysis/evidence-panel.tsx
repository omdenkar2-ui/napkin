"use client";

import { useState } from "react";
import {
  Search,
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

interface EvidenceItem {
  id: string;
  source: Source;
  channel: string;
  content: string;
  customer_name: string;
  sentiment: Sentiment;
  date: string;
  theme_ids: string[];
}

interface EvidencePanelProps {
  items: EvidenceItem[];
  totalCount: number;
  selectedThemeId: string | null;
  selectedThemeName: string | null;
  onClearFilter: () => void;
}

export function EvidencePanel({
  items,
  totalCount,
  selectedThemeId,
  selectedThemeName,
  onClearFilter,
}: EvidencePanelProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = items.filter((item) => {
    const matchesTheme = !selectedThemeId || item.theme_ids.includes(selectedThemeId);
    const matchesSearch = !search.trim() || item.content.toLowerCase().includes(search.toLowerCase());
    return matchesTheme && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-[--surface-alt]/30 rounded-xl p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-[--text-primary]">Supporting Feedback</h3>
          <span className="text-[12px] text-[--text-muted]">({selectedThemeId ? filtered.length : totalCount} items)</span>
        </div>
        {selectedThemeName && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[12px] text-[--text-muted]">
              Showing evidence for: {selectedThemeName}
            </span>
            <button
              type="button"
              onClick={onClearFilter}
              className="text-[13px] font-medium text-[--primary] hover:text-[--primary-hover] hover:underline"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[--text-muted]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search evidence..."
          className="w-full h-8 pl-9 pr-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
        />
      </div>

      {/* Evidence list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((item, index) => {
          const Icon = SOURCE_ICONS[item.source];
          const expanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={cn("py-3", index < filtered.length - 1 && "border-b border-[--border]/60")}
            >
              {/* Top row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-[--text-muted]" />
                  <span className="text-[12px] font-medium text-[--text-muted]">{item.channel}</span>
                </div>
                <span className="text-[11px] text-[--text-muted]">{item.date}</span>
              </div>

              {/* Content */}
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : item.id)}
                className="text-left w-full"
              >
                <p
                  className={cn(
                    "text-[13px] text-[--text-secondary]",
                    !expanded && "line-clamp-3",
                  )}
                >
                  {item.content}
                </p>
              </button>

              {/* Bottom row */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] text-[--text-muted]">{item.customer_name}</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded-md capitalize",
                    item.sentiment === "positive" && "bg-[#E6F7EF] text-[#166534]",
                    item.sentiment === "neutral" && "bg-[--surface-alt] text-[--text-secondary]",
                    item.sentiment === "negative" && "bg-[#FEE2E2] text-[#991B1B]",
                  )}
                >
                  {item.sentiment}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
