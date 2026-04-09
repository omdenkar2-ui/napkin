"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  subtitle: string;
  accentColor?: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

export function StatCard({ label, value, subtitle, accentColor, trend }: StatCardProps) {
  return (
    <div
      className="bg-[--surface] border border-[--border] rounded-xl p-5 shadow-sm hover:border-[--border-strong] hover:shadow-md transition-all duration-150"
      style={accentColor ? { borderLeftWidth: 3, borderLeftColor: accentColor } : undefined}
    >
      <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">
        {label}
      </p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-[28px] font-semibold text-[--text-primary] leading-tight tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[12px] font-medium px-1.5 py-0.5 rounded-md",
              trend.direction === "up" && "text-[#22A06B] bg-[#E6F7EF]",
              trend.direction === "down" && "text-[#E13238] bg-[#FDECEC]",
              trend.direction === "neutral" && "text-[--text-muted]",
            )}
          >
            {trend.direction === "up" && <TrendingUp className="w-3.5 h-3.5" />}
            {trend.direction === "down" && <TrendingDown className="w-3.5 h-3.5" />}
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-[12px] text-[--text-muted] mt-1">{subtitle}</p>
    </div>
  );
}
