"use client";

import Link from "next/link";

interface ActionSuccessProps {
  title: string;
  description: string;
  sessionId: string;
}

export function ActionSuccess({
  title,
  description,
  sessionId,
}: ActionSuccessProps) {
  return (
    <div className="space-y-6">
      <div className="bg-success/10 border border-success/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded bg-success/20 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h3 className="text-foreground font-medium text-sm">{title}</h3>
            <p className="text-sm text-muted mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Link
          href={`/sessions/${sessionId}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-muted hover:text-foreground transition-colors"
        >
          &#8635; Try again
        </Link>
      </div>
    </div>
  );
}
