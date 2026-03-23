"use client";

import { cn } from "@/lib/utils";
import { STAGES, getStageIndex } from "@/types/session";
import type { SessionStage } from "@/types/api";

interface SessionPipelineProps {
  currentStage: SessionStage;
}

export function SessionPipeline({ currentStage }: SessionPipelineProps) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
        Pipeline
      </h3>
      {STAGES.map((stage, idx) => {
        const isComplete = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const isError = currentStage === "error" && isCurrent;

        return (
          <div
            key={stage.key}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm transition-colors",
              isCurrent && !isError && "bg-accent/10 text-foreground",
              isComplete && "text-muted",
              !isCurrent && !isComplete && "text-muted/50",
              isError && "bg-red-500/10 text-red-400",
            )}
          >
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {isComplete ? (
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : isCurrent ? (
                isError ? (
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                )
              ) : (
                <span className="w-2 h-2 rounded-full bg-current opacity-30" />
              )}
            </span>
            <span className="flex-1">
              {stage.number}. {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
