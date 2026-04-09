"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150",
          "disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-[--primary] text-[--primary-text] hover:bg-[--primary-hover] border-none":
              variant === "primary",
            "bg-[--surface] text-[--text-primary] border border-[--border] hover:bg-[--surface-alt] hover:border-[--border-strong]":
              variant === "secondary",
            "text-[--text-primary] hover:bg-[--surface-alt]":
              variant === "ghost",
            "bg-[--error-soft] text-[--error] border border-[--error-soft] hover:bg-[--error]/10":
              variant === "destructive",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
export { Button };
