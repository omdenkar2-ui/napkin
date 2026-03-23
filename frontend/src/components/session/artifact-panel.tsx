"use client";

import Link from "next/link";
import type { Session } from "@/types/api";

interface ArtifactPanelProps {
  session: Session;
}

interface ArtifactLink {
  label: string;
  href: string;
  available: boolean;
}

export function ArtifactPanel({ session }: ArtifactPanelProps) {
  const artifacts: ArtifactLink[] = [
    {
      label: "Pattern Report",
      href: `/sessions/${session.id}`,
      available: !!session.pattern_report,
    },
    {
      label: "View Spec",
      href: `/sessions/${session.id}/spec`,
      available: !!session.spec_object,
    },
    {
      label: "Sprint Plan",
      href: `/sessions/${session.id}`,
      available: !!session.task_plan,
    },
    {
      label: "Exports",
      href: `/sessions/${session.id}/exports`,
      available: !!session.exports,
    },
  ];

  const availableArtifacts = artifacts.filter((a) => a.available);

  if (availableArtifacts.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
        Artifacts
      </h3>
      <div className="space-y-1">
        {availableArtifacts.map((artifact) => (
          <Link
            key={artifact.label}
            href={artifact.href}
            className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm text-foreground hover:bg-surface transition-colors"
          >
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {artifact.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
