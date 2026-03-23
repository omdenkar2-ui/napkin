"use client";

import { Spinner } from "@/components/ui/spinner";
import { getStageInfo } from "@/types/session";
import type { SessionStage } from "@/types/api";

interface ProcessingIndicatorProps {
  stage: SessionStage;
}

const stageMessages: Partial<Record<SessionStage, string>> = {
  synthesis: "Analyzing patterns across your feedback...",
  prioritization: "Ranking opportunities using RICE framework...",
  repo_context: "Analyzing your codebase...",
  spec_building: "Building your 6-section spec...",
  task_planning: "Creating sprint plan and task breakdown...",
  export: "Generating exports...",
  review: "Reviewing session...",
};

export function ProcessingIndicator({ stage }: ProcessingIndicatorProps) {
  const info = getStageInfo(stage);
  const message = stageMessages[stage] || info?.description || "Processing...";

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      <Spinner size="lg" />
      <div className="text-center">
        <p className="text-sm text-foreground">{message}</p>
        <p className="text-xs text-muted mt-1">This may take a moment</p>
      </div>
    </div>
  );
}
