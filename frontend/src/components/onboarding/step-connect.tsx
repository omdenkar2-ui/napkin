"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Hash, MessageCircle, Video, FileText, BookOpen, Mail, Table, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingProgress } from "./onboarding-progress";

interface SourceOption {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const SOURCES: SourceOption[] = [
  { id: "slack", name: "Slack", description: "Channels and threads", icon: Hash, iconBg: "#E8D5F5", iconColor: "#611F69" },
  { id: "intercom", name: "Intercom", description: "Support conversations", icon: MessageCircle, iconBg: "#E0F0FF", iconColor: "#1F8DED" },
  { id: "zoom", name: "Zoom", description: "Meeting transcripts", icon: Video, iconBg: "#E0EDFF", iconColor: "#2D8CFF" },
  { id: "typeform", name: "Typeform", description: "Survey responses", icon: FileText, iconBg: "#E8E8E8", iconColor: "#262627" },
  { id: "notion", name: "Notion", description: "Feature requests", icon: BookOpen, iconBg: "#F0F0F0", iconColor: "#1A1A1A" },
  { id: "email", name: "Email", description: "Feedback emails", icon: Mail, iconBg: "#FFF3E0", iconColor: "#E67E22" },
  { id: "spreadsheet", name: "Spreadsheets", description: "CSV or Google Sheets", icon: Table, iconBg: "#E6F4EA", iconColor: "#34A853" },
];

export function StepConnect() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <OnboardingProgress currentStep={2} />

      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/setup")}
        className="flex items-center gap-1.5 text-[13px] text-[--text-muted] hover:text-[--text-primary] transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>

      <div className="text-center">
        <h1 className="text-[24px] font-semibold text-[--text-primary] tracking-[-0.02em]">
          Connect your first source
        </h1>
        <p className="text-[14px] text-[--text-muted] mt-2">
          Where does your team receive product feedback?
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {SOURCES.map((src) => (
          <button
            key={src.id}
            type="button"
            onClick={() => setSelected(src.id === selected ? null : src.id)}
            className={cn(
              "border rounded-lg p-4 text-left cursor-pointer hover:border-[--border-strong] transition-colors",
              selected === src.id
                ? "border-[--primary] bg-[--primary-soft]"
                : "border-[--border]",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: src.iconBg }}
              >
                <src.icon className="w-5 h-5" style={{ color: src.iconColor }} />
              </div>
              <div>
                <p className="text-[14px] font-medium text-[--text-primary]">{src.name}</p>
                <p className="text-[12px] text-[--text-muted]">{src.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <button
          type="button"
          disabled={!selected}
          onClick={() => router.push("/invite")}
          className="w-full h-10 px-6 bg-[--primary] text-[--primary-text] rounded-md text-sm font-medium hover:bg-[--primary-hover] transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Continue
        </button>
        <p className="text-[11px] text-[--text-muted] text-center mt-2">
          This will start an OAuth flow in production
        </p>
      </div>
    </div>
  );
}
