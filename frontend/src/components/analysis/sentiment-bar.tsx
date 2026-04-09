"use client";

import { TrendingUp } from "lucide-react";

interface SentimentBarProps {
  positive: number;
  neutral: number;
  negative: number;
  changePercent: number;
}

export function SentimentBar({ positive, neutral, negative, changePercent }: SentimentBarProps) {
  const total = positive + neutral + negative;
  const pPct = Math.round((positive / total) * 100);
  const nePct = Math.round((neutral / total) * 100);
  const ngPct = 100 - pPct - nePct;

  return (
    <div>
      {/* Stacked bar */}
      <div className="h-2 rounded-full overflow-hidden w-full flex gap-[1px]">
        <div className="bg-[#22A06B] rounded-full" style={{ width: `${pPct}%` }} />
        <div className="bg-[#CF9F02] rounded-full" style={{ width: `${nePct}%` }} />
        <div className="bg-[#E13238] rounded-full" style={{ width: `${ngPct}%` }} />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2">
        <span className="text-[12px] font-medium text-[#22A06B]">Positive {pPct}%</span>
        <span className="text-[12px] font-medium text-[#CF9F02]">Neutral {nePct}%</span>
        <span className="text-[12px] font-medium text-[#E13238]">Negative {ngPct}%</span>
      </div>

      {/* Comparison */}
      {changePercent !== 0 && (
        <div className={`flex items-center gap-1 mt-1 text-[12px] ${changePercent > 0 ? "text-[#22A06B]" : "text-[#E13238]"}`}>
          <TrendingUp className="w-3.5 h-3.5" />
          <span>
            Sentiment {changePercent > 0 ? "improved" : "declined"} {changePercent > 0 ? "+" : ""}{changePercent}% vs last analysis
          </span>
        </div>
      )}
    </div>
  );
}
