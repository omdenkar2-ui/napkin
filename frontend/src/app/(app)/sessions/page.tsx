"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AnalysisTable, type AnalysisRow } from "@/components/analysis/analysis-table";
import { AnalysisSkeleton } from "@/components/analysis/analysis-skeleton";
import { AnalysisEmpty } from "@/components/analysis/analysis-empty";
import { PageTransition } from "@/components/ui/page-transition";

const MOCK_SESSIONS: AnalysisRow[] = [
  {
    id: "a-1",
    date: "Weekly Analysis — Apr 7",
    time: "",
    sources: ["slack", "intercom"],
    feedbackCount: "142 items",
    themesFound: "12 patterns",
    status: "completed",
  },
  {
    id: "a-2",
    date: "Monthly NPS Review — Mar 31",
    time: "",
    sources: ["typeform", "intercom"],
    feedbackCount: "98 items",
    themesFound: "8 patterns",
    status: "completed",
  },
  {
    id: "a-3",
    date: "Q1 Support Analysis — Mar 24",
    time: "",
    sources: ["intercom", "email"],
    feedbackCount: "67 items",
    themesFound: "5 patterns",
    status: "completed",
  },
  {
    id: "a-4",
    date: "Product Feedback Sprint — Mar 17",
    time: "",
    sources: ["slack", "zoom"],
    feedbackCount: "89 items",
    themesFound: "7 patterns",
    status: "completed",
  },
];

export default function SessionsPage() {
  const router = useRouter();
  const isLoading = false;
  const showEmpty = false;

  if (isLoading) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Sessions</h1>
        </div>
        <div className="p-4 md:p-8"><AnalysisSkeleton /></div>
      </div>
    );
  }

  if (!isLoading && showEmpty) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Sessions</h1>
        </div>
        <AnalysisEmpty />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          Sessions
        </h1>
        <button
          type="button"
          onClick={() => router.push("/sessions/new")}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          New Session
        </button>
      </div>

      {/* Content */}
      <PageTransition className="p-4 md:p-8">
        <AnalysisTable analyses={MOCK_SESSIONS} />
      </PageTransition>
    </div>
  );
}
