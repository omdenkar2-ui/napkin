"use client";

import { useRouter } from "next/navigation";
import { CheckSquare, BarChart3 } from "lucide-react";

export function TaskEmpty() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-[--text-muted]">
        <CheckSquare className="w-12 h-12" />
      </div>
      <h3 className="text-[16px] font-medium text-[--text-primary] mb-1">
        No tasks to review
      </h3>
      <p className="text-[14px] text-[--text-muted] max-w-[360px] mx-auto mb-6">
        Create a session to generate task recommendations from your feedback.
      </p>
      <button
        type="button"
        onClick={() => router.push("/sessions/new")}
        className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
      >
        <BarChart3 className="w-4 h-4" />
        New Session
      </button>
    </div>
  );
}
