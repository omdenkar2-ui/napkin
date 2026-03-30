import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "critical" | "opportunity" | "insight";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2.5 py-0.5 text-[11px] font-medium",
        {
          "bg-card-bg text-text-secondary border border-border": variant === "default",
          "bg-[rgba(72,199,142,0.15)] text-accent-green": variant === "success",
          "bg-[rgba(255,199,72,0.15)] text-accent-yellow": variant === "warning",
          "bg-[rgba(255,80,80,0.15)] text-accent-red": variant === "error",
          "bg-[rgba(255,80,80,0.15)] text-accent-red font-semibold uppercase tracking-wide":
            variant === "critical",
          "bg-[rgba(255,199,72,0.15)] text-accent-yellow font-semibold uppercase tracking-wide":
            variant === "opportunity",
          "bg-[rgba(99,130,255,0.15)] text-accent-blue font-semibold uppercase tracking-wide":
            variant === "insight",
        },
        className,
      )}
      {...props}
    />
  );
}
