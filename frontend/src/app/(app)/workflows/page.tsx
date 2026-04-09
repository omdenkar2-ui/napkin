"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { WorkflowTable, type Workflow } from "@/components/workflows/workflow-table";
import { WorkflowSkeleton } from "@/components/workflows/workflow-skeleton";
import { WorkflowEmpty } from "@/components/workflows/workflow-empty";
import { PageTransition } from "@/components/ui/page-transition";

const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: "wf-1",
    name: "Weekly Feedback Analysis",
    sources: ["slack", "intercom"],
    schedule: "Every Monday, 9:00 AM",
    last_run: "2 days ago",
    status: "active" as const,
  },
  {
    id: "wf-2",
    name: "Daily Slack Sync",
    sources: ["slack"],
    schedule: "Daily, 8:00 AM",
    last_run: "5 hours ago",
    status: "active" as const,
  },
  {
    id: "wf-3",
    name: "Monthly NPS Review",
    sources: ["typeform", "intercom", "email"],
    schedule: "1st of month, 10:00 AM",
    last_run: "3 weeks ago",
    status: "paused" as const,
  },
];

export default function WorkflowsPage() {
  const router = useRouter();
  const isLoading = false; // Will be replaced with React Query loading state
  const showEmpty = false;

  if (isLoading) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Workflows</h1>
        </div>
        <div className="p-4 md:p-8"><WorkflowSkeleton /></div>
      </div>
    );
  }

  if (!isLoading && showEmpty) {
    return (
      <div>
        <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Workflows</h1>
        </div>
        <WorkflowEmpty />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 bg-[--background]">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          Workflows
        </h1>
        <button
          type="button"
          onClick={() => router.push("/workflows/new")}
          className="inline-flex items-center gap-2 h-9 px-4 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Workflow
        </button>
      </div>

      {/* Content */}
      <PageTransition className="p-4 md:p-8">
        <WorkflowTable workflows={MOCK_WORKFLOWS} />
      </PageTransition>
    </div>
  );
}
