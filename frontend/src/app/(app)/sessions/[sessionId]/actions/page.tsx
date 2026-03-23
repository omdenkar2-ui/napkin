"use client";

import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { ActionSelector } from "@/components/actions/action-selector";
import { SendToEngineering } from "@/components/actions/send-to-engineering";
import { ShareWithProduct } from "@/components/actions/share-with-product";
import { ScheduleMeeting } from "@/components/actions/schedule-meeting";
import { ActionSuccess } from "@/components/actions/action-success";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { PatternReport } from "@/types/api";

type ActionType = "engineering" | "product" | "meeting" | null;

const SUCCESS_MESSAGES: Record<
  string,
  { title: string; description: string }
> = {
  engineering: {
    title: "Sent to #engineering",
    description: "Code specs and agent prompts delivered.",
  },
  product: {
    title: "Shared with product team",
    description: "Analysis summary copied to clipboard.",
  },
  meeting: {
    title: "Meeting agenda ready",
    description: "Agenda copied to clipboard.",
  },
};

export default function ActionsPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId;

  const { session, isLoading } = useSession(sessionId);
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [completedAction, setCompletedAction] = useState<string | null>(null);

  const findingIds = searchParams.get("findings")?.split(",") || [];

  const selectedFindings = useMemo(() => {
    if (!session) return [];
    const report = session.pattern_report as PatternReport | null;
    const clusters = report?.clusters || [];
    if (findingIds.length === 0) return clusters;
    return clusters.filter((c) => findingIds.includes(c.id));
  }, [session, findingIds]);

  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Success state
  if (completedAction) {
    const msg = SUCCESS_MESSAGES[completedAction] || {
      title: "Done",
      description: "Action completed.",
    };
    return (
      <div className="p-8 max-w-2xl mx-auto pt-16">
        <ActionSuccess
          title={msg.title}
          description={msg.description}
          sessionId={sessionId}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Selected findings badge */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-3 bg-surface border border-border rounded-full px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-accent-action" />
          <span className="text-sm text-foreground">
            {selectedFindings.length} finding
            {selectedFindings.length !== 1 ? "s" : ""} selected
          </span>
          {selectedFindings.length > 0 && (
            <Badge variant="default" className="max-w-48 truncate">
              {selectedFindings[0].pain_summary || selectedFindings[0].label}
            </Badge>
          )}
        </div>
      </div>

      {/* Action views */}
      {!selectedAction && (
        <ActionSelector
          onSelect={setSelectedAction}
          specData={session.spec_object}
        />
      )}

      {selectedAction === "engineering" && (
        <SendToEngineering
          findings={selectedFindings}
          onBack={() => setSelectedAction(null)}
          onSend={() => setCompletedAction("engineering")}
        />
      )}

      {selectedAction === "product" && (
        <ShareWithProduct
          findings={selectedFindings}
          onBack={() => setSelectedAction(null)}
          onSend={() => setCompletedAction("product")}
        />
      )}

      {selectedAction === "meeting" && (
        <ScheduleMeeting
          findings={selectedFindings}
          onBack={() => setSelectedAction(null)}
          onSend={() => setCompletedAction("meeting")}
        />
      )}
    </div>
  );
}
