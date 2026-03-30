import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      {icon && <div className="mb-4 text-text-ghost">{icon}</div>}
      <h3 className="text-[16px] font-medium text-foreground mb-1">{title}</h3>
      <p className="text-[14px] text-text-secondary mt-2 max-w-[360px] mx-auto mb-6">{description}</p>
      {action}
    </div>
  );
}
