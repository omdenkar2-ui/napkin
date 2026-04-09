"use client";

import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

export function WorkflowEmpty() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-[--text-muted]">
        <Zap className="w-12 h-12" />
      </div>
      <h3 className="text-[16px] font-medium text-[--text-primary] mb-1">
        No workflows configured
      </h3>
      <p className="text-[14px] text-[--text-muted] max-w-[360px] mx-auto mb-6">
        Set up automated feedback analysis on a schedule.
      </p>
      <button
        type="button"
        onClick={() => router.push("/workflows/new")}
        className="h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
      >
        Create your first workflow
      </button>
    </div>
  );
}
