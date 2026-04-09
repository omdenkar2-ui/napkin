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
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        {
          "bg-[--surface-alt] text-[--text-secondary] border border-[--border]": variant === "default",
          "bg-[#E6F7EF] text-[#166534] border border-[#BBF7D0]": variant === "success",
          "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]": variant === "warning",
          "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]": variant === "error",
          "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] uppercase tracking-[0.08em]":
            variant === "critical",
          "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] uppercase tracking-[0.08em]":
            variant === "opportunity",
          "bg-[#E8F4F6] text-[#1B6B7A] border border-[#B2DDE5] uppercase tracking-[0.08em]":
            variant === "insight",
        },
        className,
      )}
      {...props}
    />
  );
}
