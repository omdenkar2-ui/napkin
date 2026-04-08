"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw } from "lucide-react";

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
        <Badge variant="success" className="gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
          Connected
        </Badge>
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
        "rounded-[12px] bg-card-bg border border-border p-5 transition-colors hover:border-border-hover",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-foreground">{name}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-[13px] text-text-secondary mb-3">{description}</p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {status === "disconnected" && !hideConnectButton && (
              <Button size="sm" onClick={onConnect}>
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
                  className="text-[12px] text-text-tertiary hover:text-accent-red transition-colors"
                >
                  Disconnect
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
                  className="text-[12px] text-text-tertiary hover:text-accent-red transition-colors"
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
            <p className="text-[11px] text-text-ghost mt-2">
              Last synced {formatRelative(lastSynced)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default IntegrationCard;
