import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "accent" | "critical" | "opportunity" | "insight";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-surface text-muted border border-border": variant === "default",
          "bg-green-500/10 text-green-400 border border-green-500/20":
            variant === "success",
          "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20":
            variant === "warning",
          "bg-red-500/10 text-red-400 border border-red-500/20":
            variant === "error",
          "bg-accent/20 text-accent-light border border-accent/30":
            variant === "accent",
          "bg-red-500/20 text-red-400 border border-red-500/30 font-semibold uppercase tracking-wide":
            variant === "critical",
          "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold uppercase tracking-wide":
            variant === "opportunity",
          "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 font-semibold uppercase tracking-wide":
            variant === "insight",
        },
        className,
      )}
      {...props}
    />
  );
}
