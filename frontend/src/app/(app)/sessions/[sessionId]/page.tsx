"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { SimpleProgress } from "@/components/session/simple-progress";
import { PatternList } from "@/components/results/pattern-list";
import { FindingsActionBar } from "@/components/results/findings-action-bar";
import { AttachedFilesBadge } from "@/components/dashboard/attached-files-badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useFindingsSelection } from "@/hooks/use-findings-selection";
import type { PatternReport } from "@/types/api";
import Link from "next/link";

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const { session, isLoading, isProcessing, userFacingStatus } =
    useSession(sessionId);

  const { selectedIds, selectedCount, toggle } = useFindingsSelection();

  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const patternReport = session.pattern_report as PatternReport | null;
  const clusters = patternReport?.clusters || [];
  const feedbackCount =
    (session.intake_summary as { items?: unknown[] } | null)?.items?.length || 0;

  const handleContinue = () => {
    const ids = Array.from(selectedIds).join(",");
    router.push(`/sessions/${sessionId}/actions?findings=${ids}`);
  };

  // Error state
  if (session.stage === "error") {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
          title="Something went wrong"
          description="The analysis encountered an error. Please try again."
          action={
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-foreground hover:bg-border transition-colors"
            >
              Back to Dashboard
            </Link>
          }
        />
      </div>
    );
  }

  // Still processing
  if (isProcessing || clusters.length === 0) {
    return (
      <div className="p-8">
        {feedbackCount > 0 && (
          <div className="flex justify-end mb-4">
            <AttachedFilesBadge count={feedbackCount} />
          </div>
        )}
        <SimpleProgress status={userFacingStatus} fileCount={feedbackCount} />
      </div>
    );
  }

  // Results ready — show pattern cards
  return (
    <div className="p-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted mb-1">
            &#10024; Napkin found {clusters.length} pattern
            {clusters.length !== 1 ? "s" : ""} across your feedback
          </p>
        </div>
        {feedbackCount > 0 && <AttachedFilesBadge count={feedbackCount} />}
      </div>

      {/* Pattern cards */}
      <PatternList
        clusters={clusters}
        selectedIds={selectedIds}
        onToggle={toggle}
      />

      {/* Action bar */}
      <FindingsActionBar
        selectedCount={selectedCount}
        onContinue={handleContinue}
      />
    </div>
  );
}
