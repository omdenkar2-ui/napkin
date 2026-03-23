"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/api/sessions";
import { SpecViewer } from "@/components/spec/spec-viewer";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export default function SpecPage() {
  const params = useParams<{ sessionId: string }>();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", params.sessionId],
    queryFn: () => getSession(params.sessionId),
  });

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
          href={`/sessions/${params.sessionId}`}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          &larr; Back to session
        </Link>
        <h1 className="font-serif text-2xl text-foreground mt-2">
          Generated Spec
        </h1>
        <p className="text-sm text-muted mt-1">
          {session?.title || "Untitled session"}
        </p>
      </div>

      {session?.spec_object ? (
        <SpecViewer spec={session.spec_object} />
      ) : (
        <EmptyState
          title="No spec generated yet"
          description="The spec will be available once the pipeline reaches the spec building stage."
        />
      )}
    </div>
  );
}
