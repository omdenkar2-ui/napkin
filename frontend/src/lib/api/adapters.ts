/**
 * Adapters: Map backend Session data → frontend UI component shapes.
 *
 * The backend returns Session objects with pattern_report, clusters, etc.
 * Julian's UI components expect AnalysisRow, AnalysisTheme, EvidenceItem shapes.
 * These functions bridge the gap.
 */

import type { Session, SessionListItem } from "@/types/api";

/* ─── AnalysisTable row (sessions list page) ─────────────── */

export interface AnalysisRowFromBackend {
  id: string;
  date: string;
  time: string;
  sources: ("slack" | "intercom" | "zoom" | "typeform" | "notion" | "email" | "spreadsheet" | "manual")[];
  feedbackCount: string;
  themesFound: string;
  status: "completed" | "processing" | "failed";
}

export function sessionToAnalysisRow(s: SessionListItem | Session): AnalysisRowFromBackend {
  const stage = s.stage;
  const status: "completed" | "processing" | "failed" =
    stage === "done" ? "completed" : stage === "error" ? "failed" : "processing";

  const createdDate = new Date(s.created_at);
  const dateStr = s.title ?? createdDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Extract feedback count & cluster count from pattern_report if available
  let feedbackCount = "—";
  let themesFound = "—";
  if ("pattern_report" in s && s.pattern_report) {
    const pr = s.pattern_report as Record<string, unknown>;
    const total = (pr.total_items_analyzed as number) ?? 0;
    if (total > 0) feedbackCount = `${total} items`;
    const clusters = (pr.clusters as unknown[]) ?? [];
    if (clusters.length > 0) themesFound = `${clusters.length} patterns`;
  }

  return {
    id: s.id,
    date: dateStr,
    time: createdDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    sources: ["manual"],
    feedbackCount,
    themesFound,
    status,
  };
}

/* ─── AnalysisSummary themes (session detail page) ───────── */

export interface AnalysisThemeFromBackend {
  id: string;
  name: string;
  feedback_count: number;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  confidence: "high" | "medium" | "low";
}

export function sessionToThemes(session: Session): AnalysisThemeFromBackend[] {
  const pr = (session.pattern_report as Record<string, unknown>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusters = (pr.clusters as any[]) ?? [];

  return clusters.map((c, i) => {
    const severity: number = c.severity_score ?? 0;
    const conf: number = c.confidence ?? 0;

    return {
      id: c.cluster_id?.toString() ?? c.id ?? `t-${i}`,
      name: c.label ?? `Pattern ${i + 1}`,
      feedback_count: c.frequency ?? 1,
      sentiment: severity >= 7 ? "negative" : severity >= 4 ? "mixed" : "positive",
      confidence: conf >= 0.7 ? "high" : conf >= 0.4 ? "medium" : "low",
    };
  });
}

/* ─── EvidencePanel items (session detail page) ──────────── */

export interface EvidenceItemFromBackend {
  id: string;
  source: "slack" | "intercom" | "zoom" | "typeform" | "notion" | "email" | "spreadsheet" | "manual";
  channel: string;
  content: string;
  customer_name: string;
  sentiment: "positive" | "neutral" | "negative";
  date: string;
  theme_ids: string[];
}

export function sessionToEvidence(session: Session): EvidenceItemFromBackend[] {
  const pr = (session.pattern_report as Record<string, unknown>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusters = (pr.clusters as any[]) ?? [];
  const items: EvidenceItemFromBackend[] = [];

  clusters.forEach((c, ci) => {
    const themeId = c.cluster_id?.toString() ?? c.id ?? `t-${ci}`;
    const quotes: unknown[] = c.evidence_quotes ?? [];
    const severity: number = c.severity_score ?? 5;

    quotes.forEach((q, qi) => {
      const text = typeof q === "string" ? q : (q as { text?: string })?.text ?? String(q);
      items.push({
        id: `e-${ci}-${qi}`,
        source: "manual",
        channel: "Feedback",
        content: text,
        customer_name: "Customer",
        sentiment: severity >= 7 ? "negative" : severity <= 3 ? "positive" : "neutral",
        date: new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        theme_ids: [themeId],
      });
    });
  });

  return items;
}

/* ─── Summary text (session detail page) ─────────────────── */

export function sessionToSummary(session: Session): string {
  const pr = (session.pattern_report as Record<string, unknown>) ?? {};
  const total = (pr.total_items_analyzed as number) ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusters = (pr.clusters as any[]) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const critical = (pr.critical_issues as any[]) ?? [];
  const topPains = (pr.top_pains as string[]) ?? [];

  if (total === 0) return "No feedback data analyzed yet.";

  const parts: string[] = [];
  parts.push(`This session analyzed ${total} feedback item${total !== 1 ? "s" : ""}.`);

  if (clusters.length > 0) {
    parts.push(`${clusters.length} pattern${clusters.length !== 1 ? "s" : ""} were identified.`);
  }

  if (topPains.length > 0) {
    parts.push(`The top issue is "${topPains[0]}".`);
  }

  if (critical.length > 0) {
    parts.push(`${critical.length} critical issue${critical.length !== 1 ? "s" : ""} require attention.`);
  }

  return parts.join(" ");
}

/* ─── Sentiment (session detail page) ────────────────────── */

export function sessionToSentiment(session: Session): { positive: number; neutral: number; negative: number } {
  const pr = (session.pattern_report as Record<string, unknown>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusters = (pr.clusters as any[]) ?? [];

  if (clusters.length === 0) return { positive: 33, neutral: 34, negative: 33 };

  let pos = 0, neg = 0, neu = 0;
  for (const c of clusters) {
    const sev: number = c.severity_score ?? 5;
    if (sev >= 7) neg++;
    else if (sev <= 3) pos++;
    else neu++;
  }
  const total = pos + neg + neu || 1;
  return {
    positive: Math.round((pos / total) * 100),
    neutral: Math.round((neu / total) * 100),
    negative: Math.round((neg / total) * 100),
  };
}
