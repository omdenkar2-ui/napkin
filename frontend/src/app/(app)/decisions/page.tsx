"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { getOrCreateDefaultProject } from "@/lib/api/projects";
import {
  listSpecs,
  updateSpecStatus,
  recordSpecOutcome,
  type SpecListItem,
} from "@/lib/api/specs";
import { Spinner } from "@/components/ui/spinner";
import { formatRelative } from "@/lib/utils";

type TabFilter = "All" | "In Progress" | "Shipped";

const STATUS_BADGE: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  draft: {
    label: "Draft",
    color: "text-text-secondary",
    bg: "bg-[rgba(255,255,255,0.06)]",
    border: "border-[rgba(255,255,255,0.10)]",
  },
  review: {
    label: "In Review",
    color: "text-accent-yellow",
    bg: "bg-[rgba(255,199,72,0.10)]",
    border: "border-[rgba(255,199,72,0.20)]",
  },
  approved: {
    label: "Approved",
    color: "text-accent-blue",
    bg: "bg-[rgba(99,130,255,0.10)]",
    border: "border-[rgba(99,130,255,0.20)]",
  },
  shipped: {
    label: "Shipped",
    color: "text-accent-green",
    bg: "bg-[rgba(72,199,142,0.10)]",
    border: "border-[rgba(72,199,142,0.20)]",
  },
  abandoned: {
    label: "Abandoned",
    color: "text-text-ghost",
    bg: "bg-[rgba(255,255,255,0.04)]",
    border: "border-[rgba(255,255,255,0.08)]",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return (
    <span
      className={`text-[11px] font-medium uppercase tracking-wider rounded px-2 py-0.5 border ${cfg.bg} ${cfg.color} ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}

function DecisionCard({
  spec,
  onRefetch,
}: {
  spec: SpecListItem;
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [outcomeState, setOutcomeState] = useState<
    "idle" | "yes" | "no"
  >("idle");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [submittingOutcome, setSubmittingOutcome] = useState(false);
  const [mutating, setMutating] = useState(false);

  const isActive =
    spec.status !== "shipped" && spec.status !== "abandoned";

  async function handleMarkShipped() {
    setMutating(true);
    try {
      await updateSpecStatus(spec.id, "shipped");
      onRefetch();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setMutating(false);
    }
  }

  async function handleAbandon() {
    setMutating(true);
    try {
      await updateSpecStatus(spec.id, "abandoned");
      onRefetch();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setMutating(false);
    }
  }

  async function handleOutcome(worked: boolean) {
    setOutcomeState(worked ? "yes" : "no");
  }

  async function submitOutcome() {
    if (outcomeState === "idle") return;
    setSubmittingOutcome(true);
    try {
      await recordSpecOutcome(
        spec.id,
        outcomeState === "yes",
        outcomeNotes || undefined,
      );
      toast.success("Outcome recorded");
      onRefetch();
    } catch {
      toast.error("Failed to record outcome");
    } finally {
      setSubmittingOutcome(false);
    }
  }

  return (
    <div className="bg-card-bg border border-border rounded-xl mb-3 hover:border-border-hover transition-colors duration-150">
      {/* Header */}
      <div
        className="p-5 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-foreground truncate">
            {spec.decision?.what || "Untitled decision"}
          </p>
          <p className="text-[12px] text-text-tertiary mt-1">
            {formatRelative(spec.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <StatusBadge status={spec.status} />
          <svg
            className={`w-4 h-4 text-text-ghost transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          {spec.decision?.why && (
            <p className="text-[14px] text-text-secondary">
              {spec.decision.why}
            </p>
          )}

          {spec.cursor_prompt && (
            <div className="mt-4">
              <div className="bg-sidebar-bg rounded-lg p-3">
                <p className="font-mono text-[12px] text-text-tertiary line-clamp-4">
                  {spec.cursor_prompt.slice(0, 200)}
                  {spec.cursor_prompt.length > 200 ? "…" : ""}
                </p>
              </div>
              <Link
                href={`/s/${spec.session_id}`}
                className="inline-block mt-2 text-[12px] text-text-secondary hover:text-foreground transition-colors"
              >
                View full session →
              </Link>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            {isActive ? (
              <>
                <button
                  onClick={handleMarkShipped}
                  disabled={mutating}
                  className="h-8 px-3 rounded-md bg-[rgba(72,199,142,0.10)] text-accent-green border border-[rgba(72,199,142,0.20)] text-[12px] font-medium hover:bg-[rgba(72,199,142,0.20)] transition-colors disabled:opacity-50"
                >
                  Mark as shipped
                </button>
                <button
                  onClick={handleAbandon}
                  disabled={mutating}
                  className="h-8 px-3 rounded-md bg-card-bg text-text-tertiary border border-border text-[12px] font-medium hover:text-text-secondary transition-colors disabled:opacity-50"
                >
                  Abandon
                </button>
              </>
            ) : spec.status === "shipped" ? (
              <div className="w-full">
                <p className="text-[12px] font-medium text-text-secondary mb-2">
                  Did it work?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOutcome(true)}
                    className={`h-8 px-3 rounded-md text-[12px] font-medium border transition-colors ${
                      outcomeState === "yes"
                        ? "bg-[rgba(72,199,142,0.20)] text-accent-green border-[rgba(72,199,142,0.30)]"
                        : "bg-[rgba(72,199,142,0.10)] text-accent-green border-[rgba(72,199,142,0.20)] hover:bg-[rgba(72,199,142,0.20)]"
                    }`}
                  >
                    Yes — resolved
                  </button>
                  <button
                    onClick={() => handleOutcome(false)}
                    className={`h-8 px-3 rounded-md text-[12px] font-medium border transition-colors ${
                      outcomeState === "no"
                        ? "bg-[rgba(255,80,80,0.20)] text-accent-red border-[rgba(255,80,80,0.30)]"
                        : "bg-[rgba(255,80,80,0.10)] text-accent-red border-[rgba(255,80,80,0.20)] hover:bg-[rgba(255,80,80,0.20)]"
                    }`}
                  >
                    No — still an issue
                  </button>
                </div>

                {outcomeState !== "idle" && (
                  <div className="mt-3">
                    <textarea
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      placeholder="What happened?"
                      className="w-full h-20 bg-card-bg border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-text-ghost resize-none focus:border-border-focus focus:outline-none"
                    />
                    <button
                      onClick={submitOutcome}
                      disabled={submittingOutcome}
                      className="mt-2 h-8 px-3 rounded-md bg-cta-bg text-cta-text text-[12px] font-medium disabled:opacity-50"
                    >
                      {submittingOutcome ? "Saving…" : "Save outcome"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DecisionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>("All");

  useEffect(() => {
    getOrCreateDefaultProject()
      .then((p) => setProjectId(p.id))
      .catch(() => router.push("/setup"));
  }, [router]);

  const { data: specs, isLoading } = useQuery({
    queryKey: ["specs", projectId],
    queryFn: () => listSpecs(projectId!),
    enabled: !!projectId,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["specs", projectId] });
  }

  const allSpecs = (specs ?? []).slice().sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const filtered = allSpecs.filter((s) => {
    if (activeTab === "In Progress")
      return s.status === "draft" || s.status === "review" || s.status === "approved";
    if (activeTab === "Shipped")
      return s.status === "shipped" || s.status === "abandoned";
    return true;
  });

  const tabs: TabFilter[] = ["All", "In Progress", "Shipped"];

  if (!projectId || isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="max-w-[800px] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Decisions</h1>
        <p className="text-[14px] text-text-secondary mt-2">
          Track what you&apos;ve decided to build and whether it worked.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {allSpecs.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-[16px] font-medium text-foreground">
            No decisions yet
          </p>
          <p className="text-[14px] text-text-secondary mt-2 max-w-[360px]">
            Complete a session and generate a spec to start tracking decisions.
          </p>
          <Link
            href="/new"
            className="inline-flex items-center mt-6 h-10 px-5 bg-cta-bg text-cta-text rounded-lg text-[13px] font-medium"
          >
            Start a session →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[14px] text-text-tertiary py-10 text-center">
          No {activeTab.toLowerCase()} decisions.
        </p>
      ) : (
        <div>
          {filtered.map((spec) => (
            <DecisionCard key={spec.id} spec={spec} onRefetch={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
