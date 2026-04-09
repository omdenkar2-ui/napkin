"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingProgress } from "./onboarding-progress";

export function StepWorkspace() {
  const router = useRouter();
  const [name, setName] = useState("");

  return (
    <div>
      <OnboardingProgress currentStep={1} />

      <div className="text-center">
        <h1 className="text-[24px] font-semibold text-[--text-primary] tracking-[-0.02em]">
          Create your workspace
        </h1>
        <p className="text-[14px] text-[--text-muted] mt-2 max-w-[400px] mx-auto">
          This is where your team will collaborate on product feedback.
        </p>
      </div>

      <div className="mt-8 text-left">
        <label className="block text-[12px] font-medium text-[--text-muted] uppercase tracking-wider mb-1.5">
          Workspace name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Acme Inc."
          autoFocus
          className="w-full h-9 px-3 rounded-md border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:border-[--border-focus] transition-colors"
        />
        <p className="text-[11px] text-[--text-muted] mt-1.5">You can change this later in settings.</p>
      </div>

      <div className="mt-8">
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => router.push("/connect")}
          className="w-full h-10 px-6 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
