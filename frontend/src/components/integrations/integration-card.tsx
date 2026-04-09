"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw, Check } from "lucide-react";

type IntegrationStatus = "connected" | "disconnected" | "syncing" | "error";

interface IntegrationCardProps {
  provider: string;
  name: string;
  description: string;
  icon: ReactNode;
  status: IntegrationStatus;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  lastSynced?: string;
  className?: string;
  children?: ReactNode;
  hideConnectButton?: boolean;
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  switch (status) {
    case "connected":
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-[#E8F4F6] flex items-center justify-center">
            <Check className="w-3 h-3 text-[#1B6B7A]" />
          </span>
          <span className="text-[12px] font-medium text-[#166534]">Connected</span>
        </span>
      );
    case "syncing":
      return (
        <Badge variant="default" className="gap-1.5">
          <Spinner size="sm" className="w-3 h-3" />
          Syncing...
        </Badge>
      );
    case "error":
      return (
        <Badge variant="error" className="gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
          Error
        </Badge>
      );
    case "disconnected":
    default:
      return (
        <Badge variant="default">
          Disconnected
        </Badge>
      );
  }
}

export function IntegrationCard({
  name,
  description,
  icon,
  status,
  onConnect,
  onSync,
  onDisconnect,
  lastSynced,
  className,
  children,
  hideConnectButton,
}: IntegrationCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-[--surface] border border-[--border] p-5 shadow-sm min-h-[170px] flex flex-col hover:border-[--border-strong] hover:shadow-md transition-all duration-150",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-11 h-11 rounded-xl bg-[--background] border border-[--border] flex items-center justify-center shrink-0">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-semibold text-[--text-primary]">{name}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-[13px] text-[--text-muted] leading-[1.5] mb-3">{description}</p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {status === "disconnected" && !hideConnectButton && (
              <Button size="sm" variant="primary" onClick={onConnect}>
                Connect
              </Button>
            )}

            {status === "connected" && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onSync}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync now
                </Button>
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="text-[12px] font-medium text-[--primary] hover:underline transition-colors"
                >
                  Configure
                </button>
              </>
            )}

            {status === "syncing" && (
              <Button size="sm" variant="secondary" disabled>
                <Spinner size="sm" className="mr-1.5 w-3 h-3" />
                Syncing...
              </Button>
            )}

            {status === "error" && (
              <>
                <Button size="sm" variant="secondary" onClick={onSync}>
                  Retry
                </Button>
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="text-[12px] text-[--text-muted] hover:text-[--error] transition-colors"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>

          {/* Custom content (inline forms, hints, etc.) */}
          {children && <div className="mt-3">{children}</div>}

          {/* Last synced */}
          {lastSynced && status !== "disconnected" && (
            <p className="text-[11px] text-[--text-muted] mt-2">
              Last synced {formatRelative(lastSynced)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default IntegrationCard;
