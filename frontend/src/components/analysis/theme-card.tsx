"use client";

import { cn } from "@/lib/utils";

type Sentiment = "positive" | "neutral" | "negative" | "mixed";
type Confidence = "high" | "medium" | "low";

interface ThemeCardProps {
  id: string;
  name: string;
  feedbackCount: number;
  sentiment: Sentiment;
  confidence: Confidence;
  selected: boolean;
  onViewEvidence: (id: string) => void;
}

const SENTIMENT_LABEL: Record<Sentiment, { text: string; className: string }> = {
  positive: { text: "Mostly positive", className: "text-[#22A06B]" },
  neutral: { text: "Neutral", className: "text-[--text-muted]" },
  negative: { text: "Mostly negative", className: "text-[#E13238]" },
  mixed: { text: "Mixed", className: "text-[#CF9F02]" },
};

const CONFIDENCE_BADGE: Record<Confidence, { text: string; className: string }> = {
  high: { text: "High confidence", className: "bg-[#E6F7EF] text-[#166534] border border-[#BBF7D0]" },
  medium: { text: "Medium confidence", className: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]" },
  low: { text: "Needs review", className: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]" },
};

export function ThemeCard({
  id,
  name,
  feedbackCount,
  sentiment,
  confidence,
  selected,
  onViewEvidence,
}: ThemeCardProps) {
  const sentimentInfo = SENTIMENT_LABEL[sentiment];
  const confidenceInfo = CONFIDENCE_BADGE[confidence];

  return (
    <div
      className={cn(
        "bg-[--surface] border rounded-xl p-5 hover:border-[--border-strong] hover:shadow-sm cursor-pointer transition-all duration-150",
        selected ? "border-[--primary]" : "border-[--border]",
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-medium text-[--text-primary] flex-1">{name}</span>
        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0", confidenceInfo.className)}>
          {confidenceInfo.text}
        </span>
      </div>

      {/* Second row */}
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-[12px] text-[--text-muted]">Based on {feedbackCount} feedback items</span>
        <span className={cn("text-[12px]", sentimentInfo.className)}>{sentimentInfo.text}</span>
      </div>

      {/* Bottom row */}
      <div className="mt-3 pt-3 border-t border-[--border]/60 flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onViewEvidence(id); }}
          className="text-[13px] font-medium text-[--primary] hover:text-[--primary-hover] hover:underline"
        >
          View evidence →
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); console.log("generate tasks for", id); }}
          className="text-[12px] text-[--text-muted] hover:text-[--text-secondary] transition-colors"
        >
          Create tasks
        </button>
      </div>
    </div>
  );
}
