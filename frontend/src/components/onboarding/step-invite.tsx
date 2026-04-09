"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, ChevronDown } from "lucide-react";
import { OnboardingProgress } from "./onboarding-progress";

interface InviteRow {
  email: string;
  role: string;
}

export function StepInvite() {
  const router = useRouter();
  const [rows, setRows] = useState<InviteRow[]>([{ email: "", role: "member" }]);

  function updateEmail(index: number, email: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, email } : r)));
  }

  function addRow() {
    if (rows.length >= 5) return;
    setRows((prev) => [...prev, { email: "", role: "member" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <OnboardingProgress currentStep={3} />

      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/connect")}
        className="flex items-center gap-1.5 text-[13px] text-[--text-muted] hover:text-[--text-primary] transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      <div className="text-center">
        <h1 className="text-[24px] font-semibold text-[--text-primary] tracking-[-0.02em]">
          Invite your team
        </h1>
        <p className="text-[14px] text-[--text-muted] mt-2">
          Collaborate on feedback analysis with your team.
        </p>
      </div>

      <div className="mt-8">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-3 mb-3">
            <input
              type="email"
              value={row.email}
              onChange={(e) => updateEmail(index, e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 h-9 px-3 rounded-md border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:border-[--border-focus] transition-colors"
            />
            <button
              type="button"
              className="h-9 px-3 border border-[--border] rounded-md text-xs font-medium text-[--text-secondary] w-28 flex items-center justify-between hover:border-[--border-strong] transition-colors shrink-0"
            >
              Member
              <ChevronDown className="w-3 h-3 text-[--text-muted]" />
            </button>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {rows.length < 5 && (
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-[--primary] hover:underline mt-1"
          >
            <Plus className="w-4 h-4" />
            Add another
          </button>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => router.push("/analyze")}
          className="w-full h-10 px-6 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => router.push("/analyze")}
          className="text-sm text-[--text-muted] hover:text-[--text-primary] text-center transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
