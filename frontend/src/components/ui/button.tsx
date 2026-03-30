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
          "inline-flex items-center justify-center rounded-[8px] font-medium transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-white text-black hover:bg-[rgba(255,255,255,0.9)] border-none":
              variant === "primary",
            "bg-[rgba(255,255,255,0.06)] text-foreground border border-border hover:bg-[rgba(255,255,255,0.1)]":
              variant === "secondary",
            "text-foreground hover:bg-[rgba(255,255,255,0.06)]":
              variant === "ghost",
            "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20":
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
