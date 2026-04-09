"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRepoContext, syncGitHub } from "@/lib/api/integrations";
import { Spinner } from "@/components/ui/spinner";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";
import { GitBranch, RefreshCw } from "lucide-react";

interface RepoContextCardProps {
  projectId: string;
}

export function RepoContextCard({ projectId }: RepoContextCardProps) {
  const queryClient = useQueryClient();

  const { data: context, isLoading } = useQuery({
    queryKey: ["repo-context", projectId],
    queryFn: () => getRepoContext(projectId),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncGitHub(projectId),
    onSuccess: () => {
      toast.success("Repo context synced");
      queryClient.invalidateQueries({
        queryKey: ["repo-context", projectId],
      });
    },
    onError: () => {
      toast.error("Failed to sync repo context");
    },
  });

  if (isLoading) {
    return null;
  }

  if (!context || !context.summary) {
    return null;
  }

  return (
    <div className="rounded-[12px] bg-card-bg border border-border p-4 transition-colors hover:border-border-hover">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
          <GitBranch className="w-4 h-4 text-text-secondary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-[13px] font-medium text-foreground">
              {context.repo_name || "Repo Context"}
            </h4>
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="text-text-tertiary hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-hover"
              title="Sync now"
            >
              {syncMutation.isPending ? (
                <Spinner size="sm" className="w-3.5 h-3.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <p className="text-[12px] text-text-secondary leading-relaxed line-clamp-3">
            {context.summary}
          </p>

          {context.last_synced && (
            <p className="text-[11px] text-text-ghost mt-2">
              Last synced {formatRelative(context.last_synced)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default RepoContextCard;
