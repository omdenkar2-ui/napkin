"use client";

import { FeedbackRow } from "./feedback-row";

type Source = "slack" | "intercom" | "zoom" | "typeform" | "notion" | "email" | "spreadsheet" | "manual";
type Sentiment = "positive" | "neutral" | "negative";

interface FeedbackItem {
  id: string;
  source: Source;
  content: string;
  customer_name?: string;
  sentiment: Sentiment;
  created_at: string;
}

interface FeedbackListProps {
  items: FeedbackItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FeedbackList({ items, selectedId, onSelect }: FeedbackListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((item) => (
        <FeedbackRow
          key={item.id}
          id={item.id}
          source={item.source}
          content={item.content}
          customerName={item.customer_name}
          sentiment={item.sentiment}
          createdAt={item.created_at}
          selected={selectedId === item.id}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </div>
  );
}
