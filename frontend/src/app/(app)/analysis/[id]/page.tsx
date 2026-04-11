"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { AnalysisSummary } from "@/components/analysis/analysis-summary";
import { EvidencePanel } from "@/components/analysis/evidence-panel";
import { AnalysisDetailSkeleton } from "@/components/analysis/analysis-detail-skeleton";
import { PageTransition } from "@/components/ui/page-transition";

const MOCK_THEMES = [
  { id: "t-1", name: "Mobile app performance issues", feedback_count: 23, sentiment: "negative" as const, confidence: "high" as const },
  { id: "t-2", name: "Dashboard redesign feedback", feedback_count: 18, sentiment: "positive" as const, confidence: "high" as const },
  { id: "t-3", name: "Search and filter improvements", feedback_count: 14, sentiment: "mixed" as const, confidence: "high" as const },
  { id: "t-4", name: "Notification system complaints", feedback_count: 11, sentiment: "negative" as const, confidence: "low" as const },
  { id: "t-5", name: "API documentation praise", feedback_count: 9, sentiment: "positive" as const, confidence: "high" as const },
];

const MOCK_EVIDENCE = [
  { id: "e-1", source: "slack" as const, channel: "Slack #product-feedback", content: "The mobile app crashes every time I try to upload a photo. This has been happening since the last update and it's really frustrating. I've tried reinstalling but the issue persists.", customer_name: "Sarah Chen", sentiment: "negative" as const, date: "Apr 5", theme_ids: ["t-1"] },
  { id: "e-2", source: "intercom" as const, channel: "Intercom", content: "Love the new dashboard redesign! Much easier to find what I need now. The new layout feels intuitive and the loading times are much better.", customer_name: "Mike Johnson", sentiment: "positive" as const, date: "Apr 5", theme_ids: ["t-2"] },
  { id: "e-3", source: "slack" as const, channel: "Slack #feature-requests", content: "Can we get better search filters? Right now it's hard to find specific items when the list gets long. Would love tag-based filtering and date ranges.", customer_name: "Anonymous", sentiment: "neutral" as const, date: "Apr 4", theme_ids: ["t-3"] },
  { id: "e-4", source: "intercom" as const, channel: "Intercom", content: "The notification system is too aggressive. Getting emails for every small update. Need better granularity in notification preferences.", customer_name: "Chris Taylor", sentiment: "negative" as const, date: "Apr 4", theme_ids: ["t-4"] },
  { id: "e-5", source: "slack" as const, channel: "Slack #general", content: "Just wanted to say the API docs are excellent. Best I've seen for a product this size. The code examples are particularly helpful.", customer_name: "Tom Wilson", sentiment: "positive" as const, date: "Apr 3", theme_ids: ["t-5"] },
  { id: "e-6", source: "slack" as const, channel: "Slack #bugs", content: "Performance has been really slow this week, especially on mobile. Pages take 3-4 seconds to load on my iPhone.", customer_name: "James Brown", sentiment: "negative" as const, date: "Apr 3", theme_ids: ["t-1"] },
  { id: "e-7", source: "intercom" as const, channel: "Intercom", content: "The new dashboard widgets are great but I wish I could rearrange them. Also the date picker component is much improved.", customer_name: "Lisa Park", sentiment: "positive" as const, date: "Apr 2", theme_ids: ["t-2"] },
  { id: "e-8", source: "slack" as const, channel: "Slack #product-feedback", content: "Search results don't seem to include archived items. Would be useful to have an option to include them in the results.", customer_name: "Alex Rivera", sentiment: "neutral" as const, date: "Apr 1", theme_ids: ["t-3"] },
];

const SUMMARY_TEXT = "This analysis covers 142 feedback items from Slack and Intercom collected over the past week. The dominant theme is mobile app performance, mentioned in 34% of feedback. Overall sentiment has improved by 12% compared to last week, driven by positive reception of the new dashboard redesign. Three critical issues require immediate attention.";

export default function AnalysisDetailPage() {
  const router = useRouter();
  const isLoading = false; // Will be replaced with React Query loading state
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  const selectedThemeName = selectedThemeId
    ? MOCK_THEMES.find((t) => t.id === selectedThemeId)?.name ?? null
    : null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[--border] flex items-center gap-3 px-8 shrink-0">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-[--text-primary]">Analysis</h1>
        </div>
        <AnalysisDetailSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Page header */}
      <div className="h-14 border-b border-[--border] flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/analysis")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-[--text-primary]">
            Analysis — April 7, 2026
          </h1>
        </div>
        <button
          type="button"
          onClick={() => { console.log("generate tasks"); toast.success("Tasks generated"); }}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          <CheckSquare className="w-4 h-4" />
          Generate Tasks
        </button>
      </div>

      {/* Two-column layout */}
      <PageTransition className="flex flex-col lg:flex-row flex-1 min-h-0 p-4 md:p-8 gap-6">
        {/* Left column — Summary */}
        <div className="flex-[3] overflow-y-auto pr-2">
          <AnalysisSummary
            summary={SUMMARY_TEXT}
            themes={MOCK_THEMES}
            sentiment={{ positive: 45, neutral: 30, negative: 25 }}
            sentimentChange={12}
            selectedThemeId={selectedThemeId}
            onSelectTheme={setSelectedThemeId}
          />

          {/* Bottom action */}
          <div className="pt-4 border-t border-[--border] mt-6">
            <button
              type="button"
              onClick={() => { console.log("generate tasks for all"); toast.success("Tasks generated for all themes"); }}
              className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
            >
              <CheckSquare className="w-4 h-4" />
              Generate tasks for all themes
            </button>
          </div>
        </div>

        {/* Right column — Evidence */}
        <div className="flex-[2] lg:border-l lg:border-[--border] lg:pl-6 border-t border-[--border] pt-6 lg:pt-0 lg:border-t-0 overflow-hidden flex flex-col">
          <EvidencePanel
            items={MOCK_EVIDENCE}
            totalCount={142}
            selectedThemeId={selectedThemeId}
            selectedThemeName={selectedThemeName}
            onClearFilter={() => setSelectedThemeId(null)}
          />
        </div>
      </PageTransition>
    </div>
  );
}
