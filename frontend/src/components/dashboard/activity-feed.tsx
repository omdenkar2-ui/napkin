"use client";

import { cn } from "@/lib/utils";

type DotColor = "blue" | "green" | "yellow" | "gray";

interface ActivityItem {
  id: string;
  color: DotColor;
  description: string;
  timestamp: string;
}

const DOT_COLORS: Record<DotColor, string> = {
  blue: "bg-[#1B6B7A]",
  green: "bg-[#22A06B]",
  yellow: "bg-[#CF9F02]",
  gray: "bg-[#999999]",
};

const MOCK_ACTIVITIES: ActivityItem[] = [
  { id: "1", color: "blue", description: "Session completed — 12 patterns found", timestamp: "2 hours ago" },
  { id: "2", color: "green", description: "Julian approved 8 tasks → sent to Linear", timestamp: "5 hours ago" },
  { id: "3", color: "yellow", description: "Slack source synced — 34 new items", timestamp: "Yesterday" },
  { id: "4", color: "green", description: "3 tasks marked as done in Linear", timestamp: "Yesterday" },
  { id: "5", color: "blue", description: "Weekly session scheduled", timestamp: "2 days ago" },
  { id: "6", color: "yellow", description: "Intercom connected successfully", timestamp: "3 days ago" },
];

export function ActivityFeed() {
  return (
    <div className="bg-[--surface] border border-[--border] rounded-xl shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[--border]">
        <h2 className="text-[15px] font-semibold text-[--text-primary]">
          Recent Activity
        </h2>
        <a href="#" className="text-[13px] font-medium text-[--primary] hover:text-[--primary-hover] hover:underline">
          View all
        </a>
      </div>
      <div>
        {MOCK_ACTIVITIES.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-3 px-5 py-3.5",
              index < MOCK_ACTIVITIES.length - 1 && "border-b border-[--border]/60",
            )}
          >
            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", DOT_COLORS[item.color])} />
            <span className="text-[13px] text-[--text-secondary] flex-1 min-w-0 truncate">
              {item.description}
            </span>
            <span className="text-[12px] text-[--text-muted] shrink-0">
              {item.timestamp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
