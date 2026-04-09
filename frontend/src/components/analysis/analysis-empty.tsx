"use client";

import { useRouter } from "next/navigation";
import { BarChart3, Sparkles } from "lucide-react";

export function AnalysisEmpty() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-[--text-muted]">
        <BarChart3 className="w-12 h-12" />
      </div>
      <h3 className="text-[16px] font-medium text-[--text-primary] mb-1">
        No sessions yet
      </h3>
      <p className="text-[14px] text-[--text-muted] max-w-[360px] mx-auto mb-6">
        Create your first session to discover patterns in your feedback.
      </p>
      <button
        type="button"
        onClick={() => router.push("/sessions/new")}
        className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        New Session
      </button>
    </div>
  );
}
