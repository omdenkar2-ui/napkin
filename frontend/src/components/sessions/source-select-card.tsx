"use client";

import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SourceOption {
  id: string;
  name: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  itemCount: string;
  enabled: boolean;
}

interface SourceSelectCardProps {
  source: SourceOption;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function SourceSelectCard({ source, selected, onToggle }: SourceSelectCardProps) {
  return (
    <button
      type="button"
      disabled={!source.enabled}
      onClick={() => onToggle(source.id)}
      className={cn(
        "relative border rounded-xl p-4 text-left transition-all duration-150",
        source.enabled ? "cursor-pointer" : "opacity-40 cursor-not-allowed",
        selected
          ? "border-[#1B6B7A] bg-[#E8F4F6]/40"
          : "border-[#E5E2DC] hover:border-[--border-strong]",
      )}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#1B6B7A] flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", source.iconBg)}>
        <source.icon className={cn("w-[18px] h-[18px]", source.iconColor)} />
      </div>
      <p className={cn(
        "text-[13px] font-medium mt-2.5",
        selected ? "text-[#1B6B7A]" : "text-[#1A1A1A]",
      )}>
        {source.name}
      </p>
      <p className="text-[11px] text-[#999999] mt-0.5">
        {source.enabled ? source.itemCount : "Not connected"}
      </p>
    </button>
  );
}
