"use client";

import { Sparkles } from "lucide-react";
import { AnalysisTable, type AnalysisRow } from "@/components/analysis/analysis-table";
import { AnalysisSkeleton } from "@/components/analysis/analysis-skeleton";
import { AnalysisEmpty } from "@/components/analysis/analysis-empty";
import { PageTransition } from "@/components/ui/page-transition";

const MOCK_ANALYSES: AnalysisRow[] = [
  {
    id: "a-1",
    date: "April 7, 2026",
    time: "9:00 AM",
    sources: ["slack", "intercom"],
    feedbackCount: "142 items",
    themesFound: "12 themes",
    status: "completed",
  },
  {
    id: "a-2",
    date: "March 31, 2026",
    time: "9:00 AM",
    sources: ["slack", "intercom", "typeform"],
    feedbackCount: "98 items",
    themesFound: "8 themes",
    status: "completed",
  },
  {
    id: "a-3",
    date: "March 24, 2026",
    time: "9:00 AM",
    sources: ["slack"],
    feedbackCount: "67 items",
    themesFound: "5 themes",
    status: "completed",
  },
  {
    id: "a-4",
    date: "March 17, 2026",
    time: "9:00 AM",
    sources: ["slack", "intercom"],
    feedbackCount: "89 items",
    themesFound: "7 themes",
    status: "completed",
  },
];

export default function AnalysisPage() {
  const isLoading = false; // Will be replaced with React Query loading state
  const showEmpty = false;

  if (isLoading) {
    return (
      <div>
        <div className="h-14 border-b border-[--border] flex items-center justify-between px-8">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-[--text-primary]">Analysis</h1>
        </div>
        <div className="p-4 md:p-8"><AnalysisSkeleton /></div>
      </div>
    );
  }

  if (!isLoading && showEmpty) {
    return (
      <div>
        <div className="h-14 border-b border-[--border] flex items-center justify-between px-8">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-[--text-primary]">Analysis</h1>
        </div>
        <AnalysisEmpty />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[--border] flex items-center justify-between px-8">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-[--text-primary]">
          Analysis
        </h1>
        <button
          type="button"
          onClick={() => console.log("run new analysis")}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Run New Analysis
        </button>
      </div>

      {/* Content */}
      <PageTransition className="p-4 md:p-8">
        <AnalysisTable analyses={MOCK_ANALYSES} />
      </PageTransition>
    </div>
  );
}
