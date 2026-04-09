"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationOverviewCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  connected: boolean;
  lastSync?: string;
  onConnect?: () => void;
  onConfigure?: () => void;
}

export function IntegrationOverviewCard({
  name,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  connected,
  lastSync,
  onConnect,
  onConfigure,
}: IntegrationOverviewCardProps) {
  return (
    <div className="bg-[--surface] border border-[--border] rounded-lg p-5 min-h-[160px] flex flex-col hover:border-[--border-strong] transition-colors">
      {/* Top row */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <h3 className="text-[14px] font-medium text-[--text-primary]">{name}</h3>
      </div>

      {/* Description */}
      <p className="text-[13px] text-[--text-muted] mt-3 line-clamp-2">
        {description}
      </p>

      {/* Bottom row */}
      <div className="mt-auto pt-4 flex items-center justify-between">
        {connected ? (
          <>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[--success]" />
                <span className="text-[12px] font-medium text-[--success]">Connected</span>
              </div>
              {lastSync && (
                <p className="text-[11px] text-[--text-muted] mt-0.5">
                  Last sync: {lastSync}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onConfigure}
              className={cn(
                "h-8 px-3 rounded-md text-[13px] font-medium transition-colors",
                "text-[--text-secondary] hover:bg-[--surface-hover]",
              )}
            >
              Configure
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[--text-muted]" />
              <span className="text-[12px] font-medium text-[--text-muted]">Not connected</span>
            </div>
            <button
              type="button"
              onClick={onConnect}
              className="h-8 px-3 rounded-md text-[13px] font-medium bg-[--primary] text-[--primary-text] hover:bg-[--primary-hover] transition-colors"
            >
              Connect
            </button>
          </>
        )}
      </div>
    </div>
  );
}
