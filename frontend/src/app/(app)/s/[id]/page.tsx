"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { Spinner } from "@/components/ui/spinner";
import { SessionChatWidget } from "@/components/chat/session-chat-widget";
import { ApiError } from "@/lib/api/client";

/* ─── helpers ─────────────────────────────────────────────────── */

function getQuoteText(q: unknown): string {
  if (typeof q === "string") return q;
  if (q && typeof q === "object" && "text" in q) return (q as { text: string }).text;
  return String(q);
}

function getSeverityLabel(score: number): "CRITICAL" | "IMPORTANT" | "INSIGHT" {
  if (score >= 7) return "CRITICAL";
  if (score >= 4) return "IMPORTANT";
  return "INSIGHT";
}

/* ─── SeverityBadge ──────────────────────────────────────────── */

function SeverityBadge({ score }: { score: number }) {
  const label = getSeverityLabel(score);
  const classes =
    label === "CRITICAL"
      ? "bg-accent-red/10 text-accent-red border border-accent-red/20"
      : label === "IMPORTANT"
        ? "bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20"
        : "bg-accent-blue/10 text-accent-blue border border-accent-blue/20";
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wider rounded px-2 py-0.5 ${classes}`}>
      {label}
    </span>
  );
}

/* ─── PatternCard ────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PatternCard({ cluster, rank, onGenerateSpec }: { cluster: any; rank: number; onGenerateSpec: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const quotes: unknown[] = cluster.evidence_quotes ?? [];
  const topQuote = quotes[0] ? `"${getQuoteText(quotes[0])}"` : null;
  const segments: string[] = cluster.affected_segments ?? [];

  return (
    <div
      className="bg-card-bg border border-border rounded-xl p-5 mb-3 hover:border-border-hover transition-colors cursor-pointer"
      onClick={() => setExpanded((x) => !x)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Rank */}
          <span className="font-semibold text-lg text-text-ghost w-8 shrink-0 leading-none pt-0.5">
            #{rank}
          </span>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-foreground leading-snug">
              {cluster.label}
            </p>
            {topQuote && (
              <p className="text-[13px] text-text-tertiary mt-2 italic line-clamp-2">
                {topQuote}
              </p>
            )}
          </div>
        </div>
        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span className="text-[12px] text-text-tertiary whitespace-nowrap">
            {cluster.frequency} mentions
          </span>
          <span className="text-[12px] text-text-tertiary">
            {Math.round((cluster.confidence ?? 0) * 100)}%
          </span>
        </div>
      </div>

      {/* Bottom badges */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <SeverityBadge score={cluster.severity_score ?? 0} />
        {segments.slice(0, 2).map((seg: string) => (
          <span
            key={seg}
            className="bg-card-bg border border-border text-text-tertiary text-[11px] rounded px-2 py-0.5"
          >
            {seg}
          </span>
        ))}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          <div className="border-t border-border mt-4 pt-4">
            {/* All quotes */}
            <div>
              {quotes.map((q, i) => (
                <p
                  key={i}
                  className="text-[13px] text-text-secondary italic py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0"
                >
                  &ldquo;{getQuoteText(q)}&rdquo;
                </p>
              ))}
            </div>

            {/* Recommended action */}
            {cluster.recommended_action && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-ghost mb-2">
                  Recommended action
                </p>
                <p className="text-[13px] text-foreground">{cluster.recommended_action}</p>
              </div>
            )}

            {/* Generate spec button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateSpec();
              }}
              className="mt-4 w-full h-10 bg-card-bg border border-border rounded-lg text-foreground text-[13px] font-medium hover:border-border-hover hover:bg-[rgba(255,255,255,0.05)] transition-colors"
            >
              Generate spec for this pattern →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── STATE 0: Not Found ─────────────────────────────────────── */

function NotFoundState() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center text-center max-w-[360px]">
        <svg className="w-12 h-12 text-text-ghost" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[16px] font-medium text-foreground mt-4">Session not found</p>
        <p className="text-[14px] text-text-secondary mt-2">
          This session doesn&apos;t exist or may have been deleted.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1 text-[13px] text-text-secondary hover:text-foreground transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

/* ─── STATE 0b: Connection Error ─────────────────────────────── */

function ConnectionErrorState() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center text-center max-w-[360px]">
        <svg className="w-12 h-12 text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-[16px] font-medium text-foreground mt-4">Connection error</p>
        <p className="text-[14px] text-text-secondary mt-2">
          Cannot reach the server. Please check that the backend is running and try again.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1 text-[13px] text-text-secondary hover:text-foreground transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

/* ─── STATE 1: Processing ────────────────────────────────────── */

function ProcessingState({ userFacingStatus, progressPct }: { userFacingStatus: string; progressPct: number }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="flex flex-col items-center max-w-[400px] w-full px-4">
        {/* Spinner with ring */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-ping" />
          <Spinner size="md" className="relative z-10" />
        </div>

        {/* Main text */}
        <h2 className="text-xl font-semibold text-foreground mt-8 text-center">
          Napkin is analyzing your feedback
        </h2>

        {/* Status text */}
        <p className="text-[14px] text-text-secondary mt-3 text-center">
          {userFacingStatus}
        </p>

        {/* Progress bar */}
        <div className="w-full mt-6">
          <div className="h-1 w-full bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
            <div
              className="h-full bg-white/70 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.max(progressPct, 5)}%` }}
            />
          </div>
          <p className="text-[11px] text-text-ghost text-center mt-2">
            {progressPct}% complete
          </p>
        </div>

        {/* Reassurance */}
        <p className="text-[13px] text-text-ghost mt-6 text-center">
          This usually takes 30–60 seconds.
        </p>
      </div>
    </div>
  );
}

/* ─── STATE 2: Pattern Cards ─────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PatternCardsState({ session, onShowSpec }: { session: any; onShowSpec: (cluster: any) => void }) {
  const patternReport = session?.pattern_report as Record<string, unknown> ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawClusters: any[] = (patternReport?.clusters as any[]) ?? [];
  const totalItems: number =
    (patternReport?.total_items_analyzed as number) ??
    (patternReport?.total_signals_analyzed as number) ??
    0;

  const clusters = [...rawClusters].sort(
    (a, b) => (b.severity_score ?? 0) - (a.severity_score ?? 0),
  );

  const topCluster = clusters[0];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60 mb-2">
          SESSION COMPLETE
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          We found {clusters.length} pattern{clusters.length !== 1 ? "s" : ""} in your feedback
        </h1>
        <p className="text-[14px] text-text-secondary mt-1">
          from {totalItems} feedback item{totalItems !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Pattern cards */}
      <div>
        {clusters.map((cluster, i) => (
          <PatternCard
            key={cluster.id ?? cluster.cluster_id ?? i}
            cluster={cluster}
            rank={i + 1}
            onGenerateSpec={() => onShowSpec(cluster)}
          />
        ))}
      </div>

      {/* Recommendation */}
      {topCluster && (
        <div className="mt-8 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">
            Napkin recommends
          </p>
          <p className="text-[14px] text-foreground">
            Based on evidence strength, start with &ldquo;{topCluster.label}&rdquo; — it has the highest
            severity and frequency across your feedback.
          </p>
          <button
            type="button"
            onClick={() => onShowSpec(topCluster)}
            className="mt-4 bg-cta-bg text-cta-text h-11 px-6 rounded-lg text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Generate spec for &ldquo;{topCluster.label}&rdquo; →
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── STATE 3: Spec View ─────────────────────────────────────── */

function SectionLabel({ color, label, sub }: { color: string; label: string; sub?: string }) {
  const dotColor =
    color === "green"
      ? "bg-accent-green"
      : color === "blue"
        ? "bg-accent-blue"
        : color === "yellow"
          ? "bg-accent-yellow"
          : color === "purple"
            ? "bg-accent-purple"
            : "bg-accent-green";
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span className="text-[13px] font-semibold text-text-secondary">{label}</span>
      {sub && <span className="text-[12px] text-text-ghost">{sub}</span>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SpecView({ session, onBack }: { session: any; onBack: () => void }) {
  const [copied, setCopied] = useState(false);

  const spec = (session?.spec_object as Record<string, unknown>) ?? {};
  const cursorPrompt: string =
    ((spec?.cursor_prompt as string) || (session?.cursor_prompt as string)) ?? "";
  const specDecision = (spec?.decision as Record<string, unknown>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskBreakdown: any[] = (spec?.task_breakdown as any[]) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const successCriteria: any[] = (spec?.success_criteria as any[]) ?? [];
  const fourQ = (session?.four_q_answers as Record<string, unknown>) ?? {};

  const userSegment = (fourQ?.q1_segment_jtbd as string) || "user";
  const specWhat = (specDecision?.what as string) || "Build Specification";
  const specWhy = (specDecision?.why as string) || "";
  const specWhat2 = (specDecision?.what as string) || "";
  const specWhy2 = specWhy;

  // Flatten acceptance criteria from tasks
  const allCriteria: string[] = taskBreakdown
    .slice(0, 3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .flatMap((t: any) => (t.acceptance_criteria as string[]) ?? []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cursorPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div>
      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] text-text-secondary hover:text-foreground mb-8 flex items-center gap-1 transition-colors"
      >
        ← Back to patterns
      </button>

      {/* Spec header */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-ghost mb-2">
          SPEC
        </p>
        <h1 className="text-2xl font-semibold text-foreground">{specWhat}</h1>
        {specWhy && (
          <p className="text-[14px] text-text-secondary mt-2">{specWhy}</p>
        )}
      </div>

      {/* Section 1: Decision */}
      <div className="mb-10">
        <SectionLabel color="green" label="Decision" />
        {specWhat2 && (
          <p className="text-[15px] text-foreground font-medium">{specWhat2}</p>
        )}
        {specWhy2 && (
          <p className="text-[14px] text-text-secondary mt-2">{specWhy2}</p>
        )}
        {/* Evidence refs */}
        {Array.isArray(specDecision?.evidence_refs) &&
          (specDecision.evidence_refs as string[]).map((ref, i) => (
            <blockquote
              key={i}
              className="border-l-2 border-accent-blue/30 pl-4 py-1 my-3 text-[13px] italic text-text-tertiary"
            >
              {ref}
            </blockquote>
          ))}
      </div>

      {/* Section 2: User Stories */}
      <div className="mb-10">
        <SectionLabel color="blue" label="User Stories" />
        {taskBreakdown.length > 0 ? (
          <div>
            {taskBreakdown.slice(0, 3).map((task, i) => (
              <p
                key={i}
                className="text-[14px] text-foreground py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0"
              >
                As a <span className="text-text-secondary">{userSegment}</span>, I want{" "}
                <span className="font-medium">{task.title}</span> so that{" "}
                <span className="text-text-secondary">{task.description}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-text-tertiary">
            User stories will be available after spec generation.
          </p>
        )}
      </div>

      {/* Section 3: Acceptance Criteria */}
      <div className="mb-10">
        <SectionLabel color="yellow" label="Acceptance Criteria" />
        {allCriteria.length > 0 ? (
          <div>
            {allCriteria.map((criterion, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <div className="w-4 h-4 rounded border border-border mt-0.5 shrink-0" />
                <span className="text-[14px] text-foreground">{criterion}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-text-tertiary">
            Acceptance criteria will be derived from the task breakdown.
          </p>
        )}
      </div>

      {/* Section 4: Success Metrics */}
      <div className="mb-10">
        <SectionLabel color="purple" label="Success Metrics" />
        {successCriteria.length > 0 ? (
          <div>
            {successCriteria.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0"
              >
                <span className="text-[14px] text-foreground">
                  {(m.metric as string) || (m.name as string) || (m.description as string)}
                </span>
                <span className="text-[14px] font-medium text-accent-green ml-4 shrink-0">
                  {(m.target as string) ?? ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-text-tertiary">
            Define success metrics after reviewing the spec.
          </p>
        )}
      </div>

      {/* Section 5: Agent Prompt */}
      <div className="mb-10">
        <SectionLabel color="green" label="Agent Prompt" sub="Ready for Cursor or Claude Code" />
        <div className="bg-sidebar-bg border border-border rounded-xl overflow-hidden mt-3">
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-[12px] text-text-ghost font-mono">cursor-prompt.md</span>
            <button
              type="button"
              onClick={handleCopy}
              className={`h-8 px-4 rounded-md text-[12px] font-medium transition-colors ${
                copied
                  ? "bg-accent-green text-white"
                  : "bg-cta-bg text-cta-text hover:opacity-90"
              }`}
            >
              {copied ? "✓ Copied" : "Copy prompt"}
            </button>
          </div>
          {/* Prompt content */}
          <div className="px-5 py-4">
            <pre className="font-mono text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[500px] overflow-y-auto">
              {cursorPrompt || "The agent prompt will be available once the spec is complete."}
            </pre>
          </div>
        </div>
      </div>

      {/* Post-spec actions */}
      <div className="mt-8 flex flex-col gap-3 max-w-[400px]">
        <button
          type="button"
          onClick={() => toast.success("Saved to decisions")}
          className="bg-card-bg border border-border rounded-lg h-10 px-4 text-[13px] font-medium text-foreground hover:border-border-hover transition-colors text-left"
        >
          Save to decisions
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-text-tertiary hover:text-text-secondary transition-colors text-left"
        >
          ← Generate for another pattern
        </button>
      </div>
    </div>
  );
}

/* ─── Error state ────────────────────────────────────────────── */

function ErrorState() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center text-center max-w-[360px]">
        <svg className="w-12 h-12 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-[16px] font-medium text-foreground mt-4">Something went wrong</p>
        <p className="text-[14px] text-text-secondary mt-2">
          The analysis couldn&apos;t be completed. Please try again.
        </p>
        <Link
          href="/new"
          className="text-[13px] text-text-secondary hover:text-foreground transition-colors mt-4"
        >
          Try again →
        </Link>
      </div>
    </div>
  );
}

/* ─── No patterns state ──────────────────────────────────────── */

function NoPatternsState() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center text-center max-w-[360px]">
        <svg className="w-12 h-12 text-text-ghost" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
        <p className="text-[16px] font-medium text-foreground mt-4">Analysis complete</p>
        <p className="text-[14px] text-text-secondary mt-2">
          We couldn&apos;t find significant patterns. Try adding more diverse feedback.
        </p>
        <Link
          href="/new"
          className="text-[13px] text-text-secondary hover:text-foreground transition-colors mt-4"
        >
          Start new session →
        </Link>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function SessionViewPage() {
  const params = useParams<{ id: string }>();
  const { session, isLoading, error, isProcessing, userFacingStatus, progressPct } = useSession(params.id);
  const [showSpec, setShowSpec] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedCluster, setSelectedCluster] = useState<any>(null);

  const patternReport = session?.pattern_report as Record<string, unknown> ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusters: any[] = (patternReport?.clusters as any[]) ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleShowSpec = (cluster: any) => {
    setSelectedCluster(cluster);
    setShowSpec(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setShowSpec(false);
  };

  /* Loading */
  if (isLoading) {
    return (
      <div className="max-w-[800px] mx-auto p-8 min-h-[50vh] flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  /* Fetch error — session not found or backend unreachable */
  if (error && !session) {
    const isNotFound = (error instanceof ApiError && error.status === 404) || (error instanceof Error && error.message?.includes("404"));
    return (
      <div className="max-w-[800px] mx-auto p-8">
        {isNotFound ? <NotFoundState /> : <ConnectionErrorState />}
      </div>
    );
  }

  /* Error */
  if (session?.stage === "error") {
    return (
      <>
        <div className="max-w-[800px] mx-auto p-8">
          <ErrorState />
        </div>
        <div className="fixed bottom-6 right-6 z-50">
          <SessionChatWidget />
        </div>
      </>
    );
  }

  /* Processing */
  if (isProcessing) {
    return (
      <>
        <div className="max-w-[800px] mx-auto p-8">
          <ProcessingState userFacingStatus={userFacingStatus} progressPct={progressPct} />
        </div>
        <div className="fixed bottom-6 right-6 z-50">
          <SessionChatWidget />
        </div>
      </>
    );
  }

  /* Done but no patterns */
  if (session?.stage === "done" && clusters.length === 0) {
    return (
      <>
        <div className="max-w-[800px] mx-auto p-8">
          <NoPatternsState />
        </div>
        <div className="fixed bottom-6 right-6 z-50">
          <SessionChatWidget />
        </div>
      </>
    );
  }

  /* Spec view */
  if (showSpec && session) {
    return (
      <>
        <div className="max-w-[800px] mx-auto p-8">
          <SpecView session={session} onBack={handleBack} />
        </div>
        <div className="fixed bottom-6 right-6 z-50">
          <SessionChatWidget />
        </div>
      </>
    );
  }

  /* Pattern cards — the magic moment */
  if (session) {
    return (
      <>
        <div className="max-w-[800px] mx-auto p-8">
          <PatternCardsState
            session={session}
            onShowSpec={handleShowSpec}
          />
        </div>
        <div className="fixed bottom-6 right-6 z-50">
          <SessionChatWidget />
        </div>
      </>
    );
  }

  /* Fallback: session not yet loaded */
  return (
    <div className="max-w-[800px] mx-auto p-8 min-h-[50vh] flex items-center justify-center">
      <Spinner size="md" />
    </div>
  );
}
