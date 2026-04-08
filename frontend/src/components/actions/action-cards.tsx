"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listActions,
  generateActions,
  sendAction,
  type GeneratedAction,
} from "@/lib/api/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  GitBranch,
  MessageSquare,
  FileText,
  Ticket,
  Sparkles,
  ExternalLink,
  Send,
} from "lucide-react";

interface ActionCardsProps {
  sessionId: string;
  projectId: string;
}

function actionIcon(type: string) {
  switch (type) {
    case "github":
    case "github_issue":
      return <GitBranch className="w-4 h-4 text-text-secondary" />;
    case "slack":
    case "slack_message":
      return <MessageSquare className="w-4 h-4 text-text-secondary" />;
    case "document":
    case "doc":
      return <FileText className="w-4 h-4 text-text-secondary" />;
    case "ticket":
    case "jira":
    case "linear":
      return <Ticket className="w-4 h-4 text-text-secondary" />;
    default:
      return <FileText className="w-4 h-4 text-text-secondary" />;
  }
}

function statusBadgeVariant(
  status: string,
): "default" | "success" | "error" {
  switch (status) {
    case "sent":
      return "success";
    case "failed":
      return "error";
    default:
      return "default";
  }
}

function SingleActionCard({
  action,
  projectId,
}: {
  action: GeneratedAction;
  projectId: string;
}) {
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: () => sendAction(action.id, projectId),
    onSuccess: (result) => {
      toast.success("Action sent successfully");
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      if (result.external_url) {
        window.open(result.external_url, "_blank", "noopener");
      }
    },
    onError: () => {
      toast.error("Failed to send action");
    },
  });

  const isSent = action.status === "sent";
  const isFailed = action.status === "failed";

  // content can be a string or an object — normalize to string for preview
  const contentStr = typeof action.content === "string"
    ? action.content
    : (action.content as Record<string, unknown>)?.body as string
      ?? (action.content as Record<string, unknown>)?.description as string
      ?? JSON.stringify(action.content);
  const preview = contentStr.length > 200 ? contentStr.slice(0, 200) + "..." : contentStr;

  return (
    <div className="rounded-[12px] bg-card-bg border border-border p-4 transition-colors hover:border-border-hover">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 mt-0.5">
          {actionIcon(action.action_type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">
              {action.title}
            </h4>
            <Badge variant={statusBadgeVariant(action.status)}>
              {action.status}
            </Badge>
          </div>

          <p className="text-[12px] text-text-secondary leading-relaxed mb-3">
            {preview}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isSent && action.external_url ? (
              <a
                href={action.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-accent-blue hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </a>
            ) : isSent ? (
              <Badge variant="success">Sent</Badge>
            ) : (
              <Button
                size="sm"
                variant={isFailed ? "destructive" : "secondary"}
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="gap-1.5"
              >
                {sendMutation.isPending ? (
                  <Spinner size="sm" className="w-3 h-3" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                {isFailed ? "Retry" : "Send"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActionCards({ sessionId, projectId }: ActionCardsProps) {
  const queryClient = useQueryClient();

  const {
    data: actions = [],
    isLoading,
  } = useQuery({
    queryKey: ["actions", sessionId],
    queryFn: () => listActions(sessionId),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateActions(sessionId, projectId),
    onSuccess: () => {
      toast.success("Actions generated");
      queryClient.invalidateQueries({ queryKey: ["actions", sessionId] });
    },
    onError: () => {
      toast.error("Failed to generate actions");
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Actions</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="gap-1.5"
        >
          {generateMutation.isPending ? (
            <Spinner size="sm" className="w-3 h-3" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          Generate actions
        </Button>
      </div>

      {/* Actions list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" className="text-text-tertiary" />
        </div>
      ) : actions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[13px] text-text-tertiary">
            No actions yet. Generate actions from your analysis.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <SingleActionCard
              key={action.id}
              action={action}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ActionCards;
