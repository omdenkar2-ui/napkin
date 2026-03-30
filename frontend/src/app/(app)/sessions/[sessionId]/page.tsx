"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { SimpleProgress } from "@/components/session/simple-progress";
import { AttachedFilesBadge } from "@/components/dashboard/attached-files-badge";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

/* ================================================================
   TYPES
   ================================================================ */
interface CriticalIssue { title: string; severity: number; frequency: number; description: string; evidence: string[]; affected_segments: string[]; recommended_action: string; }
interface ValuableInsight { title: string; pattern_type: string; description: string; evidence: string[]; business_implication: string; confidence: number; }
interface FutureOpportunity { title: string; description: string; evidence_from_feedback: string[]; world_context: string; potential_impact: string; timeframe: string; }
interface Cluster { cluster_id: number; label: string; pain_summary: string; frequency: number; severity_score: number; confidence: number; evidence_quotes: string[]; affected_segments: string[]; recommended_action: string; signal_ids: string[]; }
interface Report { critical_issues: CriticalIssue[]; valuable_insights: ValuableInsight[]; future_opportunities: FutureOpportunity[]; clusters: Cluster[]; segments_found: string[]; total_items_analyzed: number; }
interface Opportunity { id: string; rank: number; title: string; description: string; rice_score: number; reach: number; impact: number; confidence: number; effort_weeks: number; risks: string[]; segments_served: string[]; }
interface SprintTask { id: string; title: string; description: string; type: string; estimate_hours: number; priority: string; sprint_day: number | null; dependencies: string[]; acceptance_criteria: string[]; }

/* eslint-disable @typescript-eslint/no-explicit-any */
function parse(session: any) {
  const pr = session.pattern_report || {};
  const report: Report = {
    critical_issues: pr.critical_issues || [], valuable_insights: pr.valuable_insights || [],
    future_opportunities: pr.future_opportunities || [], clusters: pr.clusters || [],
    segments_found: pr.segments_found || [], total_items_analyzed: pr.total_items_analyzed || 0,
  };
  const dec = session.decision_object || {};
  const opportunities: Opportunity[] = (dec.opportunities || []).map((o: any) => ({ ...o }));
  const recommendation: string = dec.recommendation_reasoning || "";
  const tradeoff: string = dec.tradeoff_summary || "";

  const spec = session.spec_object || {};
  const cursorPrompt: string = spec.cursor_prompt || session.cursor_prompt || "";
  const specDecision = spec.decision || {};
  const successCriteria: any[] = spec.success_criteria || [];
  const uiChanges: any[] = spec.ui_changes || [];
  const dataModel: any[] = spec.data_model || [];

  const tp = session.task_plan || {};
  const tasks: SprintTask[] = (tp.tasks || []).map((t: any) => ({ ...t }));
  const totalHours: number = tp.total_hours || 0;
  const riskFlags: string[] = tp.risk_flags || [];
  const teamLoad: Record<string, number> = tp.team_load || {};
  const checkpoints: any[] = tp.sprint_checkpoints || [];

  const fourQ = session.four_q_answers || {};

  const gr = session.gate_results || {};
  const exports = gr.exports || {};
  const tickets: any[] = exports.tickets || [];
  const analytics = exports.analytics || {};
  const charts: Record<string, string> = analytics.charts || {};
  const stats: Record<string, any> = analytics.stats || {};

  const feedbackCount = ((session.intake_summary || {}).items || []).length;

  return { report, opportunities, recommendation, tradeoff, cursorPrompt, specDecision, successCriteria, uiChanges, dataModel, tasks, totalHours, riskFlags, teamLoad, checkpoints, fourQ, tickets, charts, stats, feedbackCount };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ================================================================
   UI COMPONENTS
   ================================================================ */

function Chevron({ open }: { open: boolean }) {
  return <svg className={cn("w-4 h-4 text-muted transition-transform shrink-0", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>;
}

function Expandable({ children, detail, border }: { children: React.ReactNode; detail: React.ReactNode; border: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("bg-surface border rounded-xl transition-all", border)}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left p-5 flex items-start gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        <Chevron open={open} />
      </button>
      {open && <div className="px-5 pb-5 border-t border-border/50">{detail}</div>}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent text-xs rounded-lg hover:bg-accent/20 transition-colors"
    >
      {copied ? (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>Copied!</>
      ) : (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>{label || "Copy"}</>
      )}
    </button>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3 text-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </div>
  );
}

type Tab = "overview" | "priorities" | "sprint" | "spec" | "charts";

const CHART_LABELS: Record<string, string> = {
  emotion_distribution: "Emotion Distribution", confidence_histogram: "Extraction Confidence",
  signal_pca: "Signal Space (PCA)", cluster_severity: "Cluster Severity vs Frequency",
  cluster_heatmap: "Cluster Metrics Heatmap", rice_scores: "RICE Opportunity Scores",
  task_type_distribution: "Task Type Distribution", sprint_gantt: "Sprint Gantt Chart",
  team_load: "Team Load by Role", priority_breakdown: "Priority Breakdown",
};

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [tab, setTab] = useState<Tab>("overview");

  const { session, isLoading, isProcessing, userFacingStatus } = useSession(sessionId);

  if (isLoading || !session) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;

  const d = parse(session);

  if (session.stage === "error") {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <EmptyState
          icon={<svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
          title="Something went wrong"
          description="The analysis encountered an error. Please try again."
          action={<Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-foreground hover:bg-border transition-colors">Back to Dashboard</Link>}
        />
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="p-8">
        {d.feedbackCount > 0 && <div className="flex justify-end mb-4"><AttachedFilesBadge count={d.feedbackCount} /></div>}
        <SimpleProgress status={userFacingStatus} fileCount={d.feedbackCount} />
      </div>
    );
  }

  if (d.report.clusters.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <EmptyState icon={<svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>} title="Analysis complete" description="No significant patterns found. Try adding more data." action={<Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-foreground hover:bg-border transition-colors">Back to Dashboard</Link>} />
      </div>
    );
  }

  const totalFindings = d.report.critical_issues.length + d.report.valuable_insights.length + d.report.future_opportunities.length;
  const chartEntries = Object.entries(d.charts).filter(([, v]) => v && v.length > 0);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview", count: totalFindings },
    { id: "priorities", label: "Priorities", count: d.opportunities.length },
    { id: "sprint", label: "Sprint Plan", count: d.tasks.length },
    { id: "spec", label: "Build Spec" },
    ...(chartEntries.length > 0 ? [{ id: "charts" as Tab, label: "Charts", count: chartEntries.length }] : []),
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto pb-24">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{session.title || "Analysis"}</h1>
            <p className="text-sm text-muted mt-1">
              {d.report.total_items_analyzed} feedback items &rarr; {totalFindings} findings &middot; {d.opportunities.length} opportunities &middot; {d.tasks.length} tasks
            </p>
          </div>
          {d.feedbackCount > 0 && <AttachedFilesBadge count={d.feedbackCount} />}
        </div>

        {/* Top recommendation callout */}
        {d.opportunities.length > 0 && (
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-4">
            <p className="text-xs text-accent font-medium uppercase tracking-wider mb-1">Top Recommendation</p>
            <p className="text-sm text-foreground font-medium">#{d.opportunities[0].rank} {d.opportunities[0].title}</p>
            <p className="text-xs text-muted mt-1">{d.recommendation}</p>
            <div className="flex gap-4 mt-2 text-xs text-muted">
              <span>RICE: <strong className="text-foreground">{d.opportunities[0].rice_score}</strong></span>
              <span>Reach: {d.opportunities[0].reach}</span>
              <span>Impact: {d.opportunities[0].impact}/3</span>
              <span>Effort: {d.opportunities[0].effort_weeks}w</span>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatCard value={String(d.report.clusters.length)} label="Clusters" />
          <StatCard value={String(d.report.critical_issues.length)} label="Critical" />
          <StatCard value={String(d.tasks.length)} label="Sprint Tasks" />
          <StatCard value={`${d.totalHours}h`} label="Total Effort" />
          <StatCard value={d.opportunities[0]?.rice_score?.toString() || "—"} label="Top RICE" />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
            tab === t.id ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
          )}>
            {t.label}{t.count != null && <span className="ml-1 text-xs opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB: OVERVIEW
          ═══════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <>
          {d.report.critical_issues.length > 0 && (
            <Section title="Critical Issues" count={d.report.critical_issues.length} color="text-red-400">
              {d.report.critical_issues.map((issue, i) => (
                <Expandable key={i} border="border-red-500/20" detail={
                  <div className="space-y-3 pt-3">
                    {issue.recommended_action && <DetailBox label="Recommended Action" color="text-red-400" text={issue.recommended_action} />}
                    {issue.affected_segments.length > 0 && <TagList label="Affected Segments" items={issue.affected_segments} color="bg-red-500/10 text-red-300" />}
                    <EvidenceList items={issue.evidence} />
                  </div>
                }>
                  <div className="flex items-center gap-2 mb-1"><Badge variant="critical">SEV {issue.severity}/10</Badge><span className="text-xs text-muted">{issue.frequency} mentions</span></div>
                  <h3 className="text-foreground font-medium text-sm">{issue.title}</h3>
                  <p className="text-muted text-xs mt-1 line-clamp-2">{issue.description}</p>
                </Expandable>
              ))}
            </Section>
          )}

          {d.report.valuable_insights.length > 0 && (
            <Section title="Valuable Insights" count={d.report.valuable_insights.length} color="text-blue-400">
              {d.report.valuable_insights.map((ins, i) => (
                <Expandable key={i} border="border-blue-500/20" detail={
                  <div className="space-y-3 pt-3">
                    {ins.business_implication && <DetailBox label="Business Implication" color="text-blue-400" text={ins.business_implication} />}
                    <EvidenceList items={ins.evidence} />
                  </div>
                }>
                  <div className="flex items-center gap-2 mb-1"><Badge variant="opportunity">{(ins.pattern_type || "insight").toUpperCase()}</Badge>{ins.confidence > 0 && <span className="text-xs text-muted">{Math.round(ins.confidence * 100)}%</span>}</div>
                  <h3 className="text-foreground font-medium text-sm">{ins.title}</h3>
                  <p className="text-muted text-xs mt-1 line-clamp-2">{ins.description}</p>
                </Expandable>
              ))}
            </Section>
          )}

          {d.report.future_opportunities.length > 0 && (
            <Section title="Future Opportunities" count={d.report.future_opportunities.length} color="text-green-400">
              {d.report.future_opportunities.map((opp, i) => (
                <Expandable key={i} border="border-green-500/20" detail={
                  <div className="space-y-3 pt-3">
                    {opp.world_context && <DetailBox label="Market Context" color="text-green-400" text={opp.world_context} />}
                    {opp.potential_impact && <DetailBox label="Potential Impact" color="text-green-400" text={opp.potential_impact} />}
                    <EvidenceList items={opp.evidence_from_feedback} />
                  </div>
                }>
                  <div className="flex items-center gap-2 mb-1"><Badge variant="insight">{(opp.timeframe || "medium").toUpperCase()}</Badge></div>
                  <h3 className="text-foreground font-medium text-sm">{opp.title}</h3>
                  <p className="text-muted text-xs mt-1 line-clamp-2">{opp.description}</p>
                </Expandable>
              ))}
            </Section>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB: PRIORITIES
          ═══════════════════════════════════════════════════════ */}
      {tab === "priorities" && (
        <>
          {d.recommendation && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-4">
              <p className="text-xs text-accent font-medium mb-1">Why this ranking?</p>
              <p className="text-sm text-foreground">{d.recommendation}</p>
              {d.tradeoff && <p className="text-xs text-muted mt-2 italic">{d.tradeoff}</p>}
            </div>
          )}
          <div className="space-y-3">
            {d.opportunities.map((opp) => (
              <Expandable key={opp.id} border="border-border" detail={
                <div className="space-y-3 pt-3">
                  {opp.description && <p className="text-xs text-foreground">{opp.description}</p>}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 bg-background rounded-lg"><p className="text-sm font-bold text-foreground">{opp.reach}</p><p className="text-xs text-muted">Reach</p></div>
                    <div className="text-center p-2 bg-background rounded-lg"><p className="text-sm font-bold text-foreground">{opp.impact}</p><p className="text-xs text-muted">Impact</p></div>
                    <div className="text-center p-2 bg-background rounded-lg"><p className="text-sm font-bold text-foreground">{Math.round(opp.confidence * 100)}%</p><p className="text-xs text-muted">Confidence</p></div>
                    <div className="text-center p-2 bg-background rounded-lg"><p className="text-sm font-bold text-foreground">{opp.effort_weeks}w</p><p className="text-xs text-muted">Effort</p></div>
                  </div>
                  {opp.risks.length > 0 && <TagList label="Risks" items={opp.risks} color="bg-yellow-500/10 text-yellow-300" />}
                  {opp.segments_served.length > 0 && <TagList label="Segments" items={opp.segments_served} color="bg-blue-500/10 text-blue-300" />}
                </div>
              }>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-accent/60 w-8 shrink-0">#{opp.rank}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-foreground font-medium text-sm">{opp.title}</h3>
                    <p className="text-xs text-muted mt-0.5">RICE: <strong className="text-foreground">{opp.rice_score}</strong> &middot; {opp.reach} reach &times; {opp.impact} impact &times; {Math.round(opp.confidence * 100)}% conf &divide; {opp.effort_weeks}w</p>
                  </div>
                </div>
              </Expandable>
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB: SPRINT PLAN
          ═══════════════════════════════════════════════════════ */}
      {tab === "sprint" && (
        <>
          {/* Sprint summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <StatCard value={String(d.tasks.length)} label="Tasks" />
            <StatCard value={`${d.totalHours}h`} label="Total Hours" />
            <StatCard value={Object.keys(d.teamLoad).join(", ") || "—"} label="Roles" />
            <StatCard value={d.riskFlags.length > 0 ? String(d.riskFlags.length) : "0"} label="Risk Flags" />
          </div>

          {/* Team load */}
          {Object.keys(d.teamLoad).length > 0 && (
            <div className="flex gap-2 mb-4">
              {Object.entries(d.teamLoad).map(([role, hours]) => (
                <div key={role} className="flex-1 bg-surface border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{role}</span>
                    <span className="text-xs text-muted">{hours}h</span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, (hours / 40) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {d.riskFlags.length > 0 && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 mb-4">
              {d.riskFlags.map((f, i) => <p key={i} className="text-xs text-yellow-300">{f}</p>)}
            </div>
          )}

          {/* Tasks by sprint day */}
          <div className="space-y-2">
            {d.tasks
              .sort((a, b) => (a.sprint_day || 99) - (b.sprint_day || 99))
              .map((task) => (
              <Expandable key={task.id} border="border-border" detail={
                <div className="space-y-2 pt-3">
                  {task.description && <p className="text-xs text-foreground">{task.description}</p>}
                  {task.acceptance_criteria.length > 0 && (
                    <div>
                      <p className="text-xs text-muted font-medium mb-1">Acceptance Criteria</p>
                      <ul className="space-y-1">{task.acceptance_criteria.map((ac, j) => <li key={j} className="text-xs text-foreground flex gap-2"><span className="text-green-400 shrink-0">&#10003;</span>{ac}</li>)}</ul>
                    </div>
                  )}
                  {task.dependencies.length > 0 && <TagList label="Dependencies" items={task.dependencies} color="bg-background text-muted" />}
                </div>
              }>
                <div className="flex items-center gap-3">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-bold shrink-0",
                    task.type === "FE" ? "bg-blue-500/15 text-blue-400" :
                    task.type === "BE" ? "bg-green-500/15 text-green-400" :
                    task.type === "DB" ? "bg-purple-500/15 text-purple-400" :
                    task.type === "TEST" ? "bg-yellow-500/15 text-yellow-400" :
                    "bg-muted/15 text-muted"
                  )}>{task.type}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm text-foreground font-medium truncate">{task.title}</h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted">
                    <span>Day {task.sprint_day || "?"}</span>
                    <span className="font-medium text-foreground">{task.estimate_hours}h</span>
                  </div>
                </div>
              </Expandable>
            ))}
          </div>

          {/* Checkpoints */}
          {d.checkpoints.length > 0 && (
            <div className="mt-4 bg-surface border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Sprint Checkpoints</p>
              {d.checkpoints.map((cp, i) => <p key={i} className="text-xs text-foreground">{cp.milestone}</p>)}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB: BUILD SPEC
          ═══════════════════════════════════════════════════════ */}
      {tab === "spec" && (
        <>
          {/* Decision */}
          {(d.specDecision.what || d.specDecision.why) && (
            <div className="bg-surface border border-border rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Decision</h3>
              {d.specDecision.what && <p className="text-sm text-foreground mb-1"><strong>What:</strong> {d.specDecision.what}</p>}
              {d.specDecision.why && <p className="text-xs text-muted"><strong>Why:</strong> {d.specDecision.why}</p>}
            </div>
          )}

          {/* Success criteria */}
          {d.successCriteria.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Success Criteria</h3>
              <div className="space-y-2">
                {d.successCriteria.map((sc, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-green-400 mt-0.5 shrink-0">&#9679;</span>
                    <div>
                      <p className="text-foreground font-medium">{sc.metric || sc.description || JSON.stringify(sc)}</p>
                      {sc.target && <p className="text-muted">Target: {sc.target}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategic context */}
          {d.fourQ.q1_segment_jtbd && (
            <div className="bg-surface border border-border rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Strategic Context</h3>
              <div className="space-y-3 text-xs">
                <div><p className="text-muted font-medium">Segment & JTBD</p><p className="text-foreground">{d.fourQ.q1_segment_jtbd}</p></div>
                {d.fourQ.q2_smallest_proof && <div><p className="text-muted font-medium">Smallest Proof (2 weeks)</p><p className="text-foreground">{d.fourQ.q2_smallest_proof}</p></div>}
                {(d.fourQ.q3_non_goals || []).length > 0 && <div><p className="text-muted font-medium">Non-Goals (Out of Scope)</p>{(d.fourQ.q3_non_goals as string[]).map((ng: string, i: number) => <p key={i} className="text-foreground">&bull; {ng}</p>)}</div>}
                {(d.fourQ.q4_risks || []).length > 0 && <div><p className="text-muted font-medium">Risks</p>{(d.fourQ.q4_risks as string[]).map((r: string, i: number) => <p key={i} className="text-foreground">&bull; {r}</p>)}</div>}
              </div>
            </div>
          )}

          {/* Cursor Prompt */}
          {d.cursorPrompt && (
            <div className="bg-surface border border-accent/20 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">Cursor-Ready Prompt</h3>
                <CopyButton text={d.cursorPrompt} label="Copy Prompt" />
              </div>
              <pre className="text-xs text-muted bg-background border border-border rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                {d.cursorPrompt}
              </pre>
            </div>
          )}

          {/* Tickets */}
          {d.tickets.length > 0 && (
            <div className="mt-4 bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">Export Tickets ({d.tickets.length})</h3>
                <CopyButton text={JSON.stringify(d.tickets, null, 2)} label="Copy JSON" />
              </div>
              <div className="space-y-2">
                {d.tickets.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs p-2 bg-background rounded-lg">
                    <span className={cn("px-1.5 py-0.5 rounded font-medium",
                      t.priority === "urgent" ? "bg-red-500/15 text-red-400" :
                      t.priority === "high" ? "bg-yellow-500/15 text-yellow-400" :
                      "bg-blue-500/15 text-blue-400"
                    )}>{t.priority}</span>
                    <span className="text-foreground flex-1 truncate">{t.title}</span>
                    <span className="text-muted shrink-0">{t.effort_estimate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB: CHARTS
          ═══════════════════════════════════════════════════════ */}
      {tab === "charts" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chartEntries.map(([name, base64]) => (
            <div key={name} className="bg-surface border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">{CHART_LABELS[name] || name.replace(/_/g, " ")}</h3>
              <img src={`data:image/png;base64,${base64}`} alt={CHART_LABELS[name] || name} className="w-full rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Back */}
      <div className="text-center mt-8">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm text-muted hover:text-foreground hover:bg-border transition-colors">Back to Dashboard</Link>
      </div>
    </div>
  );
}

/* ================================================================
   Shared small components
   ================================================================ */

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className={cn("text-sm font-medium uppercase tracking-wider mb-3", color)}>{title} ({count})</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function DetailBox({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div className="bg-background border border-border rounded-lg p-3">
      <p className={cn("text-xs mb-1 font-medium", color)}>{label}</p>
      <p className="text-xs text-foreground">{text}</p>
    </div>
  );
}

function TagList({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
      <p className="text-xs text-muted mb-1 font-medium">{label}</p>
      <div className="flex flex-wrap gap-1">{items.map((s, j) => <span key={j} className={cn("text-xs rounded px-2 py-0.5", color)}>{s}</span>)}</div>
    </div>
  );
}

function EvidenceList({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-muted mb-1 font-medium">Evidence ({items.length})</p>
      <div className="space-y-1">{items.map((e, j) => <p key={j} className="text-xs text-muted bg-background border border-border rounded px-3 py-2 italic">&ldquo;{typeof e === "string" ? e : ""}&rdquo;</p>)}</div>
    </div>
  );
}
