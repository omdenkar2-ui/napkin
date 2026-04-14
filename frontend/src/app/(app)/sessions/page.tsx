"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AnalysisTable } from "@/components/analysis/analysis-table";
import { AnalysisSkeleton } from "@/components/analysis/analysis-skeleton";
import { AnalysisEmpty } from "@/components/analysis/analysis-empty";
import { PageTransition } from "@/components/ui/page-transition";
import { useSessions, useDeleteSession } from "@/hooks/use-api";
import { useProject } from "@/providers/project-provider";
import { sessionToAnalysisRow } from "@/lib/api/adapters";
import { toast } from "sonner";

export default function SessionsPage() {
  const router = useRouter();
  const { projectId, loading: projectLoading } = useProject();
  const { data: sessions, isLoading: sessionsLoading } = useSessions(projectId);
  const deleteMutation = useDeleteSession();

  const isLoading = projectLoading || sessionsLoading;
  const rows = (sessions ?? []).map(sessionToAnalysisRow);

  const handleDelete = (id: string) => {
    if (!confirm("Delete this session? This can't be undone.")) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success("Session deleted"),
      onError: () => toast.error("Failed to delete session"),
    });
  };

  if (isLoading) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Sessions</h1>
        </div>
        <div className="p-4 md:p-8"><AnalysisSkeleton /></div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Sessions</h1>
          <button
            type="button"
            onClick={() => router.push("/sessions/new")}
            className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            New Session
          </button>
        </div>
        <AnalysisEmpty />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          Sessions
        </h1>
        <button
          type="button"
          onClick={() => router.push("/sessions/new")}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          New Session
        </button>
      </div>

      {/* Content */}
      <PageTransition className="p-4 md:p-8">
        <AnalysisTable analyses={rows} onDelete={handleDelete} />
      </PageTransition>
    </div>
  );
}
