"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-[8px] bg-card-bg border border-border px-3 py-2",
        "text-sm text-foreground placeholder:text-text-tertiary resize-y",
        "focus:outline-none focus:border-border-focus transition-colors duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
export { Textarea };
