"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { PatternCluster } from "@/types/api";

interface SendToEngineeringProps {
  findings: PatternCluster[];
  onBack: () => void;
  onSend: () => void;
}

function getSeverityEmoji(score: number): string {
  if (score >= 0.7) return "\uD83D\uDD34";
  if (score >= 0.4) return "\uD83D\uDFE1";
  return "\u2139\uFE0F";
}

function getSeverityLabel(score: number): string {
  if (score >= 0.7) return "Critical";
  if (score >= 0.4) return "Opportunity";
  return "Insight";
}

export function SendToEngineering({
  findings,
  onBack,
  onSend,
}: SendToEngineeringProps) {
  const [channel] = useState("#engineering");

  const messageText = useMemo(() => {
    const lines = [
      `Hey team \u2014 Napkin analyzed this week's feedback across your sources.\n`,
    ];
    for (const finding of findings) {
      const emoji = getSeverityEmoji(finding.severity_score);
      const label = getSeverityLabel(finding.severity_score);
      lines.push(
        `${emoji} ${label}: ${finding.pain_summary || finding.label}`,
      );
      if (finding.evidence_quotes.length > 0) {
        lines.push(
          `  Evidence: "${finding.evidence_quotes[0].text.substring(0, 100)}..."`,
        );
      }
      lines.push(
        `  Est. effort: ${finding.frequency > 5 ? "2-3 hours" : "1-2 hours"}\n`,
      );
    }
    return lines.join("\n");
  }, [findings]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(messageText);
    onSend();
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-4"
      >
        &larr; Back
      </button>

      <Badge variant="default" className="mb-4">
        {channel}
      </Badge>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-border px-4 py-2 flex items-center gap-3">
          <button type="button" className="text-xs text-muted hover:text-foreground font-bold">B</button>
          <button type="button" className="text-xs text-muted hover:text-foreground italic">I</button>
          <button type="button" className="text-xs text-muted hover:text-foreground line-through">S</button>
          <button type="button" className="text-xs text-muted hover:text-foreground font-mono">&lt;/&gt;</button>
          <button type="button" className="text-xs text-muted hover:text-foreground">@</button>
          <span className="flex-1" />
          <span className="text-xs text-muted">Click to edit</span>
        </div>

        {/* Message preview */}
        <div className="p-5">
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {messageText}
          </pre>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mt-4">
        <Badge variant="error">Priority: High</Badge>
        <Badge variant="default">Sprint: this week</Badge>
        {findings.some((f) => f.severity_score >= 0.7) && (
          <Badge variant="accent">{findings.length} agent prompts</Badge>
        )}
      </div>

      {/* Send button */}
      <div className="flex justify-end mt-6">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "var(--accent-action)" }}
          onMouseOver={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--accent-action-hover)")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--accent-action)")
          }
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
          </svg>
          Send to {channel}
        </button>
      </div>
    </div>
  );
}
