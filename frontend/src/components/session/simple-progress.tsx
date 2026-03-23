"use client";

import { Spinner } from "@/components/ui/spinner";

interface SimpleProgressProps {
  status: string;
  fileCount?: number;
}

export function SimpleProgress({ status, fileCount }: SimpleProgressProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </div>

      <div className="text-center max-w-md">
        <h2 className="font-serif text-xl text-foreground mb-2">
          Napkin is analyzing your feedback
        </h2>
        <p className="text-sm text-muted">{status}</p>
        {fileCount !== undefined && fileCount > 0 && (
          <p className="text-xs text-muted mt-3">
            Processing {fileCount} file{fileCount !== 1 ? "s" : ""}
          </p>
        )}
        <p className="text-xs text-muted/60 mt-4">
          You can leave this page open — we&apos;ll have your results ready when
          you come back.
        </p>
      </div>

      {/* Animated progress dots */}
      <div className="flex gap-1.5 mt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:300ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:600ms]" />
      </div>
    </div>
  );
}
