"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  FileText,
  MessageSquare,
  Sparkles,
  Target,
  ListChecks,
  BarChart3,
  Code,
  AlertTriangle,
  Lightbulb,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { EvidencePanel } from "@/components/analysis/evidence-panel";
import { AnalysisDetailSkeleton } from "@/components/analysis/analysis-detail-skeleton";
import { SessionChat } from "@/components/sessions/session-chat";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";
import { useSession, useRetrySession, useDeleteSession } from "@/hooks/use-api";
import { sessionToEvidence } from "@/lib/api/adapters";

/* ─── Types ─────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDict = Record<string, any>;

/* ─── Severity Badge ────────────────────────────────────── */

function SeverityBadge({ score }: { score: number }) {
  const label = score >= 7 ? "URGENT" : score >= 4 ? "IMPORTANT" : "GOOD TO KNOW";
  const style =
    score >= 7
      ? "bg-red-50 text-red-700 border-red-200"
      : score >= 4
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-blue-50 text-blue-700 border-blue-200";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5 border ${style}`}>
      {label}
    </span>
  );
}

/* ─── Pattern Card (expandable) ─────────────────────────── */

function PatternCard({ cluster, rank }: { cluster: AnyDict; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const quotes: string[] = (cluster.evidence_quotes ?? []).map((q: unknown) =>
    typeof q === "string" ? q : (q as { text?: string })?.text ?? String(q),
  );
  const segments: string[] = cluster.affected_segments ?? [];

  return (
    <div
      className={cn(
        "bg-[--surface] border rounded-xl transition-all duration-150",
        expanded ? "border-[#1B6B7A]/30 shadow-sm" : "border-[--border] hover:border-[--border-strong]",
      )}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-start gap-3 p-4 text-left cursor-pointer"
      >
        <span className="text-[16px] font-semibold text-[--text-muted] w-7 shrink-0 pt-0.5">
          #{rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[--text-primary] leading-snug">
            {cluster.label}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <SeverityBadge score={cluster.severity_score ?? 0} />
            <span className="text-[12px] text-[--text-muted]">
              {cluster.frequency ?? 1} mention{(cluster.frequency ?? 1) !== 1 ? "s" : ""}
            </span>
            <span className="text-[12px] text-[--text-muted]">
              {Math.round((cluster.confidence ?? 0) * 100)}% confidence
            </span>
          </div>
          {quotes[0] && !expanded && (
            <p className="text-[13px] text-[--text-secondary] mt-2 italic line-clamp-1">
              &ldquo;{quotes[0]}&rdquo;
            </p>
          )}
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[--text-muted]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[--text-muted]" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[--border]/60 px-4 pb-4 pt-3">
          {/* Pain summary */}
          {cluster.pain_summary && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1">Summary</p>
              <p className="text-[13px] text-[--text-secondary] leading-relaxed">{cluster.pain_summary}</p>
            </div>
          )}

          {/* Evidence quotes */}
          {quotes.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-2">Evidence</p>
              {quotes.map((q, i) => (
                <p key={i} className="text-[13px] text-[--text-secondary] italic py-1.5 border-b border-[--border]/40 last:border-0">
                  &ldquo;{q}&rdquo;
                </p>
              ))}
            </div>
          )}

          {/* Affected segments */}
          {segments.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-2">Who&apos;s Impacted</p>
              <div className="flex flex-wrap gap-1.5">
                {segments.map((seg) => (
                  <span key={seg} className="bg-[--surface-alt] border border-[--border] text-[--text-secondary] text-[11px] rounded-md px-2 py-0.5">
                    {seg}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended action */}
          {cluster.recommended_action && (
            <div className="bg-[#E8F4F6]/30 border border-[#1B6B7A]/10 rounded-lg p-3">
              <p className="text-[11px] font-semibold text-[#1B6B7A] uppercase tracking-wider mb-1">What To Do About It</p>
              <p className="text-[13px] text-[--text-primary]">{cluster.recommended_action}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Section Header ────────────────────────────────────── */

function SectionHeader({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-[#1B6B7A]" />
      <h2 className="text-[16px] font-semibold text-[--text-primary] tracking-tight">{label}</h2>
      {count !== undefined && (
        <span className="text-[11px] font-semibold text-[--text-muted] bg-[--surface-alt] rounded-md px-2 py-0.5 border border-[--border]">
          {count}
        </span>
      )}
    </div>
  );
}

/* ─── Recommendation & Action Plan ──────────────────────── */

function SpecSection({ session }: { session: AnyDict }) {
  const [copied, setCopied] = useState(false);

  const spec = (session.spec_object as AnyDict) ?? {};
  const decision = (spec.decision as AnyDict) ?? {};
  const taskBreakdown: AnyDict[] = spec.task_breakdown ?? [];
  const successCriteria: AnyDict[] = spec.success_criteria ?? [];
  const cursorPrompt: string = session.cursor_prompt ?? spec.cursor_prompt ?? "";
  const fourQ = (session.four_q_answers as AnyDict) ?? {};

  const hasSpec = Object.keys(spec).length > 0;
  if (!hasSpec) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cursorPrompt);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="mt-8 space-y-8">
      {/* What We Recommend */}
      {decision && Object.keys(decision).length > 0 && (
        <div>
          <SectionHeader icon={Target} label="What We Recommend" />
          <div className="bg-[--surface] border border-[--border] rounded-xl p-5">
            {decision.target_segment && (
              <p className="text-[14px] text-[--text-primary] font-medium">{decision.target_segment}</p>
            )}
            {decision.success_definition && (
              <p className="text-[13px] text-[--text-secondary] mt-2 leading-relaxed">{decision.success_definition}</p>
            )}
            {decision.what && (
              <p className="text-[14px] text-[--text-primary] font-medium mt-2">{decision.what}</p>
            )}
            {decision.why && (
              <p className="text-[13px] text-[--text-secondary] mt-1 leading-relaxed">{decision.why}</p>
            )}
          </div>
        </div>
      )}

      {/* Who This Affects & Strategy */}
      {fourQ.q1_segment_jtbd && (
        <div>
          <SectionHeader icon={Lightbulb} label="Who This Affects" />
          <div className="bg-[--surface] border border-[--border] rounded-xl p-5 space-y-4">
            {fourQ.q1_segment_jtbd && (
              <div>
                <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1">Who & What They Need</p>
                <p className="text-[13px] text-[--text-primary] leading-relaxed">{fourQ.q1_segment_jtbd}</p>
              </div>
            )}
            {fourQ.q2_smallest_proof && (
              <div>
                <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1">Quick Win to Start With</p>
                <p className="text-[13px] text-[--text-primary] leading-relaxed">{fourQ.q2_smallest_proof}</p>
              </div>
            )}
            {fourQ.q3_non_goals?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1">Out of Scope</p>
                <ul className="space-y-1">
                  {(fourQ.q3_non_goals as string[]).map((ng: string, i: number) => (
                    <li key={i} className="text-[13px] text-[--text-secondary] flex items-start gap-2">
                      <span className="text-[--text-muted] shrink-0">-</span>
                      {ng}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Plan */}
      {taskBreakdown.length > 0 && (
        <div>
          <SectionHeader icon={ListChecks} label="Action Plan" count={taskBreakdown.length} />
          <div className="space-y-2">
            {taskBreakdown.map((task, i) => (
              <div key={i} className="bg-[--surface] border border-[--border] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-[#E8F4F6] text-[#1B6B7A] text-[11px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-[14px] font-medium text-[--text-primary]">{task.task ?? task.title}</p>
                </div>
                {/* What "done" looks like */}
                {task.acceptance_criteria && (
                  <div className="mt-3 pt-3 border-t border-[--border]/40">
                    <p className="text-[11px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1.5">Done when</p>
                    {(Array.isArray(task.acceptance_criteria) ? task.acceptance_criteria : [task.acceptance_criteria]).map((ac: string, j: number) => (
                      <div key={j} className="flex items-start gap-2 py-1">
                        <div className="w-3.5 h-3.5 rounded border border-[--border] mt-0.5 shrink-0" />
                        <span className="text-[13px] text-[--text-secondary]">{ac}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How We'll Measure Success */}
      {successCriteria.length > 0 && (
        <div>
          <SectionHeader icon={BarChart3} label="How We'll Measure Success" count={successCriteria.length} />
          <div className="bg-[--surface] border border-[--border] rounded-xl overflow-hidden">
            {successCriteria.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start justify-between p-4",
                  i < successCriteria.length - 1 && "border-b border-[--border]/60",
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-[--text-primary]">
                    {m.metric ?? m.name ?? m.description}
                  </p>
                  {m.current_state && (
                    <p className="text-[12px] text-[--text-muted] mt-1">Today: {m.current_state}</p>
                  )}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-[14px] font-semibold text-[#166534]">{m.target_state ?? m.target ?? ""}</p>
                  {m.timeline && (
                    <p className="text-[11px] text-[--text-muted] mt-0.5">{m.timeline}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hand Off to Engineering */}
      {cursorPrompt && (
        <div>
          <SectionHeader icon={Code} label="Hand Off to Engineering" />
          <p className="text-[12px] text-[--text-muted] mb-3 -mt-2">Copy this and give it to your engineering team or paste it into an AI coding tool</p>
          <div className="bg-[#1A1A1A] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
              <span className="text-[12px] text-white/50">Implementation brief</span>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "h-7 px-3 rounded-md text-[12px] font-medium transition-colors",
                  copied
                    ? "bg-green-600 text-white"
                    : "bg-white/10 text-white/80 hover:bg-white/20",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </span>
              </button>
            </div>
            <div className="px-4 py-4">
              <pre className="font-mono text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto">
                {cursorPrompt}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Insights Section ──────────────────────────────────── */

function InsightsSection({ patternReport }: { patternReport: AnyDict }) {
  const critical: AnyDict[] = patternReport.critical_issues ?? [];
  const insights: AnyDict[] = patternReport.valuable_insights ?? [];
  const opportunities: AnyDict[] = patternReport.future_opportunities ?? [];

  if (critical.length === 0 && insights.length === 0 && opportunities.length === 0) return null;

  return (
    <div className="mt-8 space-y-6">
      {critical.length > 0 && (
        <div>
          <SectionHeader icon={AlertTriangle} label="Fix These First" count={critical.length} />
          <div className="space-y-2">
            {critical.map((c, i) => (
              <div key={i} className="bg-red-50/50 border border-red-200/60 rounded-xl p-4">
                <p className="text-[14px] font-medium text-[--text-primary]">{c.title}</p>
                <p className="text-[13px] text-[--text-secondary] mt-1 leading-relaxed">{c.description}</p>
                {c.recommended_action && (
                  <div className="mt-3 pt-3 border-t border-red-200/40">
                    <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1">What to do</p>
                    <p className="text-[13px] text-[--text-primary]">{c.recommended_action}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div>
          <SectionHeader icon={Lightbulb} label="What Your Users Are Telling You" count={insights.length} />
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div key={i} className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-4">
                <p className="text-[14px] font-medium text-[--text-primary]">{ins.title}</p>
                <p className="text-[13px] text-[--text-secondary] mt-1 leading-relaxed">{ins.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {opportunities.length > 0 && (
        <div>
          <SectionHeader icon={Rocket} label="Where This Could Go" count={opportunities.length} />
          <div className="space-y-2">
            {opportunities.map((opp, i) => (
              <div key={i} className="bg-green-50/50 border border-green-200/60 rounded-xl p-4">
                <p className="text-[14px] font-medium text-[--text-primary]">{opp.title}</p>
                <p className="text-[13px] text-[--text-secondary] mt-1 leading-relaxed">{opp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */

type RightPanel = "evidence" | "chat";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isLoading } = useSession(params.id);
  const retryMutation = useRetrySession();
  const deleteMutation = useDeleteSession();
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanel>("evidence");
  const [staleMinutes, setStaleMinutes] = useState(0);
  const lastStageRef = useRef<string | null>(null);
  const lastStageChangeRef = useRef<number>(Date.now());

  // Track how long we've been stuck on the same stage
  useEffect(() => {
    if (!session) return;
    if (session.stage !== lastStageRef.current) {
      lastStageRef.current = session.stage;
      lastStageChangeRef.current = Date.now();
      setStaleMinutes(0);
    }
    if (session.stage === "done" || session.stage === "error") return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastStageChangeRef.current) / 60000);
      setStaleMinutes(elapsed);
    }, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const handleRetry = () => {
    retryMutation.mutate(params.id);
  };

  const patternReport = (session?.pattern_report as AnyDict) ?? {};
  const clusters: AnyDict[] = patternReport.clusters ?? [];
  const evidence = session ? sessionToEvidence(session) : [];
  const totalItems: number = patternReport.total_items_analyzed ?? 0;

  const isProcessing = !!session && session.stage !== "done" && session.stage !== "error";

  const selectedThemeName = selectedThemeId
    ? clusters.find((c) => (c.cluster_id?.toString() ?? c.id) === selectedThemeId)?.label ?? null
    : null;

  /* Loading */
  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[#E5E2DC] flex items-center gap-3 px-8 shrink-0 bg-[--background]">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Session</h1>
        </div>
        <AnalysisDetailSkeleton />
      </div>
    );
  }

  /* Processing */
  if (isProcessing) {
    const stageLabels: Record<string, string> = {
      intake: "Processing your feedback...",
      synthesis: "Finding patterns across your feedback...",
      prioritization: "Ranking opportunities...",
      four_questions: "Analyzing strategic context...",
      spec_building: "Building recommendations...",
      task_planning: "Creating action plan...",
    };

    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[#E5E2DC] flex items-center gap-3 px-8 shrink-0 bg-[--background]">
          <button type="button" onClick={() => router.push("/sessions")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
            {session.title ?? "Session"}
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center max-w-[400px] w-full px-4 text-center">
            <div className="relative w-12 h-12 flex items-center justify-center mb-6">
              <div className="absolute inset-0 border-2 border-[#1B6B7A]/20 rounded-full animate-ping" />
              <div className="w-8 h-8 border-2 border-[#1B6B7A] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-[--text-primary]">Analyzing your feedback</h2>
            <p className="text-[14px] text-[--text-secondary] mt-3">{stageLabels[session.stage] ?? "Processing..."}</p>
            {staleMinutes < 3 ? (
              <p className="text-[13px] text-[--text-muted] mt-6">Grab a coffee while Napkin does its magic.</p>
            ) : (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center max-w-[360px]">
                <p className="text-[14px] text-amber-800 font-medium">This is taking longer than expected</p>
                <p className="text-[13px] text-amber-700 mt-1">
                  Stuck on this step for {staleMinutes} minute{staleMinutes !== 1 ? "s" : ""}. There may have been a network issue.
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retryMutation.isPending}
                  className="mt-3 px-4 py-2 bg-amber-600 text-white text-[13px] font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {retryMutation.isPending ? "Retrying..." : "Retry Analysis"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* Error */
  if (session?.stage === "error") {
    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[#E5E2DC] flex items-center gap-3 px-8 shrink-0 bg-[--background]">
          <button type="button" onClick={() => router.push("/sessions")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">Session</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-[360px]">
            <p className="text-[16px] font-medium text-[--text-primary]">Something went wrong</p>
            <p className="text-[14px] text-[--text-secondary] mt-2">
              {(session.messages as Array<{content?: string}> | undefined)?.at(-1)?.content
                ?? "The analysis could not be completed."}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={handleRetry}
                disabled={retryMutation.isPending}
                className="px-4 py-2 bg-[#1B6B7A] text-white text-[13px] font-medium rounded-lg hover:bg-[#155A67] transition-colors disabled:opacity-50"
              >
                {retryMutation.isPending ? "Retrying..." : "Retry Analysis"}
              </button>
              <button type="button" onClick={() => router.push("/sessions/new")}
                className="text-[13px] text-[#1B6B7A] hover:underline">
                Start new session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Done but no data — empty result */
  const hasResults = clusters.length > 0
    || (patternReport.critical_issues as unknown[] | undefined)?.length
    || (patternReport.valuable_insights as unknown[] | undefined)?.length
    || (patternReport.future_opportunities as unknown[] | undefined)?.length;

  if (session?.stage === "done" && !hasResults) {
    // Check for error message from the pipeline
    const lastMsg = (session.messages as Array<{content?: string; role?: string}> | undefined)
      ?.filter((m) => m.role === "assistant")
      ?.at(-1)?.content;

    return (
      <div className="flex flex-col h-[calc(100vh-0px)]">
        <div className="h-14 border-b border-[#E5E2DC] flex items-center gap-3 px-8 shrink-0 bg-[--background]">
          <button type="button" onClick={() => router.push("/sessions")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
            {session.title ?? "Session"}
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-[400px] px-4">
            <div className="w-12 h-12 rounded-full bg-[--surface-alt] flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-[--text-muted]" />
            </div>
            <p className="text-[16px] font-medium text-[--text-primary]">No patterns found</p>
            <p className="text-[14px] text-[--text-secondary] mt-2 leading-relaxed">
              {lastMsg || "The analysis completed but no feedback patterns were detected. This usually happens when the feedback text wasn't included in the session."}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => router.push("/sessions/new")}
                className="px-4 py-2 bg-[#1B6B7A] text-white text-[13px] font-medium rounded-lg hover:bg-[#155A67] transition-colors"
              >
                Start New Session
              </button>
              <button
                type="button"
                onClick={() => { deleteMutation.mutate(params.id, { onSuccess: () => router.push("/sessions") }); }}
                className="text-[13px] text-[--text-muted] hover:text-red-600 transition-colors"
              >
                Delete this session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Done — full results */
  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center justify-between px-8 shrink-0 bg-[--background]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push("/sessions")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
            {session?.title ?? "Session"}
          </h1>
          <span className="inline-flex items-center gap-1.5 bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE] text-[11px] font-medium rounded-md px-2.5 py-0.5">
            <Sparkles className="w-[13px] h-[13px]" />
            AI Generated
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <PageTransition className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Left column — Patterns + Spec + Insights */}
        <div className="flex-[3] overflow-y-auto p-4 md:p-8">
          {/* Summary bar */}
          {totalItems > 0 && (
            <div className="bg-[--surface-alt] border border-[--border]/60 rounded-xl p-4 mb-6">
              <p className="text-[14px] text-[--text-secondary] leading-relaxed">
                Analyzed <strong className="text-[--text-primary]">{totalItems} feedback items</strong>
                {clusters.length > 0 && <> and found <strong className="text-[--text-primary]">{clusters.length} patterns</strong></>}.
                {(patternReport.critical_issues?.length ?? 0) > 0 && (
                  <> <strong className="text-red-700">{patternReport.critical_issues.length} critical issues</strong> require attention.</>
                )}
              </p>
            </div>
          )}

          {/* Patterns */}
          {clusters.length > 0 && (
            <div>
              <SectionHeader icon={Target} label="Patterns Identified" count={clusters.length} />
              <div className="space-y-2">
                {[...clusters]
                  .sort((a, b) => (b.severity_score ?? 0) - (a.severity_score ?? 0))
                  .map((cluster, i) => (
                    <PatternCard key={cluster.cluster_id ?? cluster.id ?? i} cluster={cluster} rank={i + 1} />
                  ))}
              </div>
            </div>
          )}

          {/* Critical Issues, Insights, Opportunities */}
          <InsightsSection patternReport={patternReport} />

          {/* Spec, Roadmap, Metrics, Cursor Prompt */}
          {session && <SpecSection session={session} />}
        </div>

        {/* Right column — Evidence + Chat */}
        <div className="flex-[2] lg:border-l lg:border-[--border] overflow-hidden flex flex-col border-t border-[--border] lg:border-t-0">
          {/* Tab switcher */}
          <div className="flex items-center border-b border-[#E5E2DC] px-4">
            <button
              type="button"
              onClick={() => setActiveRightPanel("evidence")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium cursor-pointer transition-colors duration-100",
                activeRightPanel === "evidence"
                  ? "text-[#1B6B7A] border-b-2 border-[#1B6B7A]"
                  : "text-[#999999] hover:text-[#4A4A4A]",
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Evidence
            </button>
            <button
              type="button"
              onClick={() => setActiveRightPanel("chat")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium cursor-pointer transition-colors duration-100",
                activeRightPanel === "chat"
                  ? "text-[#1B6B7A] border-b-2 border-[#1B6B7A]"
                  : "text-[#999999] hover:text-[#4A4A4A]",
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0 p-4">
            {activeRightPanel === "evidence" ? (
              <EvidencePanel
                items={evidence}
                totalCount={totalItems || evidence.length}
                selectedThemeId={selectedThemeId}
                selectedThemeName={selectedThemeName}
                onClearFilter={() => setSelectedThemeId(null)}
              />
            ) : (
              <SessionChat sessionId={params.id} dataPointCount={totalItems || evidence.length} />
            )}
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
