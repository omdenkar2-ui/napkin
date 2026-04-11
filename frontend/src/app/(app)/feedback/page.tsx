"use client";

import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { FeedbackFilters } from "@/components/feedback/feedback-filters";
import { FeedbackList } from "@/components/feedback/feedback-list";
import { FeedbackDetailPanel } from "@/components/feedback/feedback-detail-panel";
import { useAddFeedback } from "@/components/feedback/add-feedback-context";
import { FeedbackSkeleton } from "@/components/feedback/feedback-skeleton";
import { FeedbackEmpty } from "@/components/feedback/feedback-empty";
import { PageTransition } from "@/components/ui/page-transition";

type Source = "slack" | "intercom" | "zoom" | "typeform" | "notion" | "email" | "spreadsheet" | "manual";
type Sentiment = "positive" | "neutral" | "negative";

interface FeedbackItem {
  id: string;
  source: Source;
  content: string;
  customer_name?: string;
  customer_email?: string;
  sentiment: Sentiment;
  status: "unread" | "read" | "archived";
  tags: string[];
  created_at: string;
  source_channel?: string;
}

const MOCK_FEEDBACK: FeedbackItem[] = [
  {
    id: "1",
    source: "slack",
    content: "The mobile app crashes every time I try to upload a photo. This has been happening since the last update and it's really frustrating.",
    customer_name: "Sarah Chen",
    customer_email: "sarah@company.com",
    sentiment: "negative",
    status: "unread",
    tags: ["bug", "mobile", "upload"],
    created_at: "2h ago",
    source_channel: "#product-feedback",
  },
  {
    id: "2",
    source: "intercom",
    content: "Love the new dashboard redesign! Much easier to find what I need now.",
    customer_name: "Mike Johnson",
    customer_email: "mike@example.com",
    sentiment: "positive",
    status: "read",
    tags: ["praise", "dashboard"],
    created_at: "3h ago",
  },
  {
    id: "3",
    source: "slack",
    content: "Can we get dark mode support? Working late at night and the bright screen is painful.",
    sentiment: "neutral",
    status: "unread",
    tags: ["feature-request", "ui"],
    created_at: "5h ago",
    source_channel: "#feature-requests",
  },
  {
    id: "4",
    source: "typeform",
    content: "The onboarding process was smooth but I got confused at the integrations step. Maybe add a tooltip?",
    customer_name: "Lisa Park",
    customer_email: "lisa@startup.io",
    sentiment: "neutral",
    status: "read",
    tags: ["onboarding", "ux"],
    created_at: "Yesterday",
  },
  {
    id: "5",
    source: "intercom",
    content: "Export to CSV is broken. Getting a 500 error every time.",
    customer_name: "David Kim",
    customer_email: "david@corp.com",
    sentiment: "negative",
    status: "unread",
    tags: ["bug", "export"],
    created_at: "Yesterday",
  },
  {
    id: "6",
    source: "zoom",
    content: "In our customer call today, three people mentioned wanting better search filters in the product.",
    customer_name: "(from transcript)",
    sentiment: "neutral",
    status: "read",
    tags: ["feature-request", "search"],
    created_at: "Yesterday",
  },
  {
    id: "7",
    source: "slack",
    content: "Just wanted to say the API docs are excellent. Best I've seen for a product this size.",
    customer_name: "Tom Wilson",
    sentiment: "positive",
    status: "read",
    tags: ["praise", "docs"],
    created_at: "2 days ago",
    source_channel: "#general",
  },
  {
    id: "8",
    source: "email",
    content: "We're considering upgrading to the team plan but need SSO support first.",
    customer_name: "Jennifer Lee",
    customer_email: "jlee@enterprise.com",
    sentiment: "neutral",
    status: "unread",
    tags: ["feature-request", "enterprise"],
    created_at: "2 days ago",
  },
  {
    id: "9",
    source: "notion",
    content: "Feature request: ability to set recurring tasks with custom intervals.",
    customer_name: "Alex Rivera",
    sentiment: "neutral",
    status: "read",
    tags: ["feature-request", "tasks"],
    created_at: "3 days ago",
  },
  {
    id: "10",
    source: "intercom",
    content: "The notification system is too aggressive. Getting emails for every small update.",
    customer_name: "Chris Taylor",
    customer_email: "chris@mail.com",
    sentiment: "negative",
    status: "read",
    tags: ["bug", "notifications"],
    created_at: "3 days ago",
  },
  {
    id: "11",
    source: "typeform",
    content: "NPS score: 9. Comment: Everything works great, would love more integrations.",
    customer_name: "Maria Garcia",
    sentiment: "positive",
    status: "read",
    tags: ["nps", "integrations"],
    created_at: "4 days ago",
  },
  {
    id: "12",
    source: "slack",
    content: "Performance has been really slow this week, especially on the analytics page.",
    customer_name: "James Brown",
    sentiment: "negative",
    status: "unread",
    tags: ["bug", "performance"],
    created_at: "5 days ago",
    source_channel: "#bugs",
  },
];

export default function FeedbackPage() {
  const { openModal } = useAddFeedback();
  const isLoading = false; // Will be replaced with React Query loading state
  const showEmpty = false;
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return MOCK_FEEDBACK;
    const q = search.toLowerCase();
    return MOCK_FEEDBACK.filter(
      (item) =>
        item.content.toLowerCase().includes(q) ||
        item.customer_name?.toLowerCase().includes(q) ||
        item.source.includes(q),
    );
  }, [search]);

  const selectedItem = selectedId
    ? MOCK_FEEDBACK.find((item) => item.id === selectedId) ?? null
    : null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[--border] flex items-center justify-between px-8 shrink-0">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-[--text-primary]">Feedback</h1>
        </div>
        <FeedbackSkeleton />
      </div>
    );
  }

  if (!isLoading && showEmpty) {
    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[--border] flex items-center justify-between px-8 shrink-0">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-[--text-primary]">Feedback</h1>
        </div>
        <FeedbackEmpty />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Page header */}
      <div className="h-14 border-b border-[--border] flex items-center justify-between px-8 shrink-0">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-[--text-primary]">
          Feedback
        </h1>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Feedback
        </button>
      </div>

      {/* Body: filters + list + panel */}
      <PageTransition className="flex flex-1 min-h-0">
        {/* Left: filters + list */}
        <div className="flex-1 flex flex-col min-w-0">
          <FeedbackFilters search={search} onSearchChange={setSearch} />
          <FeedbackList
            items={filtered}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          />
        </div>

        {/* Right: detail panel */}
        {selectedItem && (
          <FeedbackDetailPanel
            item={selectedItem}
            onClose={() => setSelectedId(null)}
          />
        )}
      </PageTransition>
    </div>
  );
}
