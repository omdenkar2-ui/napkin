"use client";

import { Sparkles } from "lucide-react";
import { ThemeCard } from "./theme-card";
import { SentimentBar } from "./sentiment-bar";

interface AnalysisTheme {
  id: string;
  name: string;
  feedback_count: number;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  confidence: "high" | "medium" | "low";
}

interface AnalysisSummaryProps {
  summary: string;
  themes: AnalysisTheme[];
  sentiment: { positive: number; neutral: number; negative: number };
  sentimentChange: number;
  selectedThemeId: string | null;
  onSelectTheme: (id: string | null) => void;
}

export function AnalysisSummary({
  summary,
  themes,
  sentiment,
  sentimentChange,
  selectedThemeId,
  onSelectTheme,
}: AnalysisSummaryProps) {
  return (
    <div>
      {/* AI badge */}
      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE] text-[11px] font-medium rounded-md px-2.5 py-0.5">
          <Sparkles className="w-[13px] h-[13px]" />
          AI Generated
        </span>
      </div>

      {/* Summary */}
      <div className="bg-[--surface-alt] border border-[--border]/60 rounded-xl p-6 mb-6">
        <p className="text-[14px] text-[--text-secondary] leading-relaxed">{summary}</p>
      </div>

      {/* Patterns Identified */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[16px] font-semibold text-[--text-primary] tracking-tight">Patterns Identified</h2>
          <span className="text-[11px] font-semibold text-[--text-muted] bg-[--surface-alt] rounded-md px-2 py-0.5 border border-[--border]">
            {themes.length} patterns
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              id={theme.id}
              name={theme.name}
              feedbackCount={theme.feedback_count}
              sentiment={theme.sentiment}
              confidence={theme.confidence}
              selected={selectedThemeId === theme.id}
              onViewEvidence={(id) =>
                onSelectTheme(selectedThemeId === id ? null : id)
              }
            />
          ))}
        </div>
      </div>

      {/* Sentiment Overview */}
      <div>
        <h2 className="text-[16px] font-semibold text-[--text-primary] tracking-tight mb-4">Sentiment Overview</h2>
        <SentimentBar
          positive={sentiment.positive}
          neutral={sentiment.neutral}
          negative={sentiment.negative}
          changePercent={sentimentChange}
        />
      </div>
    </div>
  );
}
