"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
}

const STEPS = ["Workspace", "Connect", "Invite", "Analyze"];

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-between w-full mb-8">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const completed = step < currentStep;
        const current = step === currentStep;
        const future = step > currentStep;

        return (
          <div key={label} className="flex items-center flex-1 last:flex-initial">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                  completed && "bg-[--primary] text-white",
                  current && "border-2 border-[--primary] text-[--primary]",
                  future && "border-2 border-[--border] text-[--text-muted]",
                )}
              >
                {completed ? <Check className="w-4 h-4" /> : step}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium mt-1.5",
                  (completed || current) && "text-[--primary]",
                  current && "font-semibold",
                  future && "text-[--text-muted]",
                )}
              >
                {label}
              </span>
            </div>

            {/* Connecting line */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-[2px] flex-1 mx-2 mt-[-18px]",
                  step < currentStep ? "bg-[--primary]" : "bg-[--border]",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
