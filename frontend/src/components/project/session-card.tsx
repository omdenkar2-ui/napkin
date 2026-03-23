"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import { getStageInfo } from "@/types/session";
import type { SessionListItem } from "@/types/api";

function stageBadgeVariant(
  status: string,
  stage: string,
): "default" | "success" | "warning" | "error" | "accent" {
  if (status === "completed" || stage === "done") return "success";
  if (status === "error" || stage === "error") return "error";
  if (status === "active") return "accent";
  return "default";
}

export function SessionCard({ session }: { session: SessionListItem }) {
  const stageInfo = getStageInfo(session.stage);

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:border-accent/30 transition-colors cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">
              {session.title || "Untitled session"}
            </h3>
            <p className="text-xs text-muted mt-1">
              {formatRelative(session.created_at)}
            </p>
          </div>
          <Badge variant={stageBadgeVariant(session.status, session.stage)}>
            {stageInfo?.label || session.stage}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}
