"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSession, getExportPrd } from "@/lib/api/sessions";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { toast } from "sonner";

export default function ExportsPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getSession(sessionId),
  });

  const exports = session?.exports;
  const tickets = exports?.tickets || [];
  const cursorPrompt =
    exports?.cursor_prompt || session?.spec_object?.cursor_prompt;

  const handleDownloadCSV = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/sessions/${sessionId}/exports/tickets`,
        {
          headers: { Accept: "text/csv" },
        },
      );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tickets.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download CSV");
    }
  };

  const handleDownloadPRD = async () => {
    try {
      const result = await getExportPrd(sessionId);
      if (result.prd_url) {
        window.open(result.prd_url, "_blank");
      }
    } catch {
      toast.error("PRD not available");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/sessions/${sessionId}`}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          &larr; Back to session
        </Link>
        <h1 className="font-serif text-2xl text-foreground mt-2">Exports</h1>
        <p className="text-sm text-muted mt-1">
          {session?.title || "Untitled session"}
        </p>
      </div>

      {!exports ? (
        <EmptyState
          title="No exports yet"
          description="Exports will be available once the session completes."
        />
      ) : (
        <div className="space-y-6">
          {/* Tickets */}
          {tickets.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="mb-0">
                  Tickets ({tickets.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(tickets, null, 2),
                      );
                      toast.success("JSON copied");
                    }}
                  >
                    Copy JSON
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadCSV}
                  >
                    Download CSV
                  </Button>
                </div>
              </div>
              <CardContent className="space-y-3">
                {tickets.map((ticket, i) => (
                  <div
                    key={i}
                    className="border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {ticket.title}
                      </p>
                      <Badge
                        variant={
                          ticket.priority === "urgent"
                            ? "error"
                            : ticket.priority === "high"
                              ? "warning"
                              : "default"
                        }
                      >
                        {ticket.priority}
                      </Badge>
                      <Badge variant="default">{ticket.effort_estimate}</Badge>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      RICE: {ticket.rice_score} &middot;{" "}
                      {ticket.source_feedback_count} feedback items
                    </p>
                    {ticket.labels.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {ticket.labels.map((label, j) => (
                          <Badge key={j} variant="default">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* PRD */}
          <Card>
            <CardTitle>PRD Document</CardTitle>
            <CardContent>
              <Button variant="secondary" onClick={handleDownloadPRD}>
                Download PDF
              </Button>
            </CardContent>
          </Card>

          {/* Cursor Prompt */}
          {cursorPrompt && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="mb-0">Cursor Prompt</CardTitle>
                <CopyButton text={cursorPrompt} />
              </div>
              <CardContent>
                <pre className="text-sm text-foreground bg-background rounded-[8px] p-4 overflow-x-auto whitespace-pre-wrap border border-border max-h-96 overflow-y-auto">
                  {cursorPrompt}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Sprint Plan */}
          {session?.task_plan && (
            <Card>
              <CardTitle>Sprint Plan</CardTitle>
              <CardContent>
                <pre className="text-sm text-foreground bg-background rounded-[8px] p-4 overflow-x-auto whitespace-pre-wrap border border-border max-h-96 overflow-y-auto">
                  {JSON.stringify(session.task_plan, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
