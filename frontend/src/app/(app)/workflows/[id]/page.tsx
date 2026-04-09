"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WorkflowForm } from "@/components/workflows/workflow-form";
import { PageTransition } from "@/components/ui/page-transition";

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === "new";

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center gap-3 px-8 bg-[--background]">
        <button
          type="button"
          onClick={() => router.push("/workflows")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          {isNew ? "Create Workflow" : "Edit Workflow"}
        </h1>
      </div>

      {/* Content */}
      <PageTransition className="p-4 md:p-8">
        <WorkflowForm isNew={isNew} />
      </PageTransition>
    </div>
  );
}
