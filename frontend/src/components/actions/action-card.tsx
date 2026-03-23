"use client";

import { cn } from "@/lib/utils";

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tags?: string[];
  onClick: () => void;
  className?: string;
}

export function ActionCard({
  icon,
  title,
  description,
  tags,
  onClick,
  className,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left bg-surface border border-border rounded-xl p-5 hover:border-muted transition-all group",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-foreground text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted mt-1">{description}</p>
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-muted bg-background border border-border rounded px-2 py-0.5 font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <svg
          className="w-5 h-5 text-muted group-hover:text-foreground transition-colors shrink-0 mt-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  );
}
