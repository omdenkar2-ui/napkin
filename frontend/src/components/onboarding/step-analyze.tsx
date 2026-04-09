"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, BarChart3, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { OnboardingProgress } from "./onboarding-progress";

const STATUS_MESSAGES = [
  "Connecting to Slack...",
  "Extracting feedback items...",
  "Analyzing sentiment and patterns...",
  "Generating insights...",
  "Almost done...",
];

export function StepAnalyze() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const completedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    toast.success("Your first analysis is ready!");
    router.push("/");
  }, [router]);

  useEffect(() => {
    if (!processing) return;

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2.5;
      });
    }, 100);

    // Status message cycling
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => Math.min(prev + 1, STATUS_MESSAGES.length - 1));
    }, 1500);

    // Complete after 4 seconds
    const completeTimeout = setTimeout(() => {
      handleComplete();
    }, 4200);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
      clearTimeout(completeTimeout);
    };
  }, [processing, handleComplete]);

  if (processing) {
    return (
      <div>
        <OnboardingProgress currentStep={4} />

        <div className="text-center">
          <h1 className="text-[24px] font-semibold text-[--text-primary] tracking-[-0.02em]">
            Analyzing your feedback...
          </h1>
          <p className="text-[14px] text-[--text-muted] mt-2">
            This usually takes about 30 seconds.
          </p>
        </div>

        <div className="mt-8">
          <div className="h-2 bg-[--surface-alt] rounded-full overflow-hidden w-full">
            <div
              className="h-full bg-[--primary] rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-[13px] text-[--text-secondary] mt-3 text-center">
            {STATUS_MESSAGES[messageIndex]}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <OnboardingProgress currentStep={4} />

      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/invite")}
        className="flex items-center gap-1.5 text-[13px] text-[--text-muted] hover:text-[--text-primary] transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      <div className="text-center">
        <h1 className="text-[24px] font-semibold text-[--text-primary] tracking-[-0.02em]">
          Run your first analysis
        </h1>
        <p className="text-[14px] text-[--text-muted] mt-2 max-w-[440px] mx-auto">
          Napkin will analyze your connected feedback and find patterns and actionable insights.
        </p>
      </div>

      {/* Preview illustration */}
      <div className="mt-8 bg-[--surface-alt] rounded-xl p-8">
        <div className="flex justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <Sparkles className="w-6 h-6 text-[--primary]" />
            <span className="text-xs text-[--text-muted]">Items will appear here</span>
            <span className="text-[11px] font-medium text-[--text-muted] uppercase">Feedback</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[--primary]" />
            <span className="text-xs text-[--text-muted]">Patterns detected</span>
            <span className="text-[11px] font-medium text-[--text-muted] uppercase">Patterns</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <CheckSquare className="w-6 h-6 text-[--primary]" />
            <span className="text-xs text-[--text-muted]">Ready for review</span>
            <span className="text-[11px] font-medium text-[--text-muted] uppercase">Tasks</span>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setProcessing(true)}
          className="w-full h-10 px-6 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors inline-flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Analyze My Feedback
        </button>
      </div>
    </div>
  );
}
