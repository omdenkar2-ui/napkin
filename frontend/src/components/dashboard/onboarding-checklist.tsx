"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingChecklistProps {
  completedSteps: number[];
}

const STEPS = [
  { id: 1, label: "Create workspace", href: "" },
  { id: 2, label: "Connect a feedback source", href: "/integrations" },
  { id: 3, label: "Invite your team", href: "/team" },
  { id: 4, label: "Create your first session", href: "/sessions/new" },
];

export function OnboardingChecklist({ completedSteps }: OnboardingChecklistProps) {
  return (
    <div className="bg-[--surface] border border-[--border] rounded-lg p-5">
      <h3 className="text-[16px] font-medium text-[--text-primary] mb-4">
        Get started with Napkin
      </h3>
      {STEPS.map((step, index) => {
        const completed = completedSteps.includes(step.id);
        return (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 py-2.5",
              index < STEPS.length - 1 && "border-b border-[--border]",
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                completed
                  ? "bg-[--success]"
                  : "border-2 border-[--border] bg-transparent",
              )}
            >
              {completed && <Check className="w-3 h-3 text-white" />}
            </div>
            <span
              className={cn(
                "text-[13px] flex-1",
                completed ? "text-[--text-muted] line-through" : "text-[--text-primary]",
              )}
            >
              {step.label}
            </span>
            {!completed && step.href && (
              <Link href={step.href} className="text-sm text-[--primary]">
                →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
