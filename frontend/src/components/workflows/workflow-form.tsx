"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Hash,
  MessageCircle,
  Video,
  FileText,
  BookOpen,
  Mail,
  Table,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Frequency = "daily" | "weekly" | "monthly" | "manual";

interface SourceDef {
  id: string;
  name: string;
  icon: LucideIcon;
  enabled: boolean;
}

const SOURCES: SourceDef[] = [
  { id: "slack", name: "Slack", icon: Hash, enabled: true },
  { id: "intercom", name: "Intercom", icon: MessageCircle, enabled: true },
  { id: "zoom", name: "Zoom", icon: Video, enabled: false },
  { id: "typeform", name: "Typeform", icon: FileText, enabled: false },
  { id: "notion", name: "Notion", icon: BookOpen, enabled: true },
  { id: "email", name: "Email", icon: Mail, enabled: false },
  { id: "spreadsheet", name: "Spreadsheets", icon: Table, enabled: false },
];

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "manual", label: "Manual only" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WorkflowFormProps {
  isNew: boolean;
}

export function WorkflowForm({ isNew }: WorkflowFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [days, setDays] = useState<number[]>([0]); // 0 = Monday
  const [time, setTime] = useState("09:00 AM");
  const [options, setOptions] = useState({
    identify_themes: true,
    analyze_sentiment: true,
    auto_generate_tasks: false,
    notify_team: true,
  });

  function toggleSource(id: string) {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function toggleDay(index: number) {
    setDays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index],
    );
  }

  function toggleOption(key: keyof typeof options) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const summary = useMemo(() => {
    const parts: string[] = [];

    if (frequency === "manual") {
      parts.push("On demand");
    } else if (frequency === "daily") {
      parts.push(`Every day at ${time}`);
    } else if (frequency === "weekly") {
      const dayNames = days.sort().map((d) => DAYS[d]);
      parts.push(`Every ${dayNames.join(", ")} at ${time}`);
    } else if (frequency === "monthly") {
      parts.push(`1st of every month at ${time}`);
    }

    if (selectedSources.length > 0) {
      const sourceNames = selectedSources.map(
        (id) => SOURCES.find((s) => s.id === id)?.name ?? id,
      );
      parts.push(`analyze new feedback from ${sourceNames.join(" and ")}`);
    } else {
      parts.push("analyze new feedback from all sources");
    }

    const enabledOptions: string[] = [];
    if (options.identify_themes) enabledOptions.push("identify themes");
    if (options.analyze_sentiment) enabledOptions.push("analyze sentiment");
    if (options.auto_generate_tasks) enabledOptions.push("generate task drafts");
    if (options.notify_team) enabledOptions.push("notify team when complete");

    if (enabledOptions.length > 0) {
      const last = enabledOptions.pop()!;
      const optionStr =
        enabledOptions.length > 0
          ? `${enabledOptions.join(", ")}, and ${last}`
          : last;
      parts.push(optionStr);
    }

    const joined = parts.join(", ");
    return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
  }, [frequency, days, time, selectedSources, options]);

  function handleSave() {
    console.log("Saving workflow:", { name, sources: selectedSources, frequency, days, time, options });
    toast.success("Workflow saved");
    router.push("/workflows");
  }

  return (
    <div className="max-w-[640px] mx-auto pb-8">
      {/* Section 1 — Basics */}
      <section>
        <h2 className="text-[16px] font-semibold text-[--text-primary] tracking-tight mb-4">Basics</h2>
        <div>
          <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
            Workflow name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Weekly feedback analysis"
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
          />
        </div>
      </section>

      {/* Section 2 — Sources */}
      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-[--text-primary] tracking-tight mb-1">Sources</h2>
        <p className="text-[13px] text-[--text-muted] mb-4">Select which integrations to include</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SOURCES.map((src) => {
            const selected = selectedSources.includes(src.id);
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => src.enabled && toggleSource(src.id)}
                disabled={!src.enabled}
                className={cn(
                  "flex items-center gap-3 border rounded-lg p-3 text-left transition-all duration-150",
                  !src.enabled && "opacity-50 pointer-events-none",
                  src.enabled && !selected && "border-[--border] hover:border-[--border-strong] cursor-pointer",
                  selected && "border-[--primary] bg-[--primary-soft]/60 shadow-sm cursor-pointer",
                )}
              >
                <src.icon className="w-[18px] h-[18px] text-[--text-secondary] shrink-0" />
                <div>
                  <span className="text-[13px] font-medium text-[--text-primary]">{src.name}</span>
                  {!src.enabled && (
                    <span className="block text-[11px] text-[--text-muted]">Not connected</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 3 — Schedule */}
      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-[--text-primary] tracking-tight mb-4">Schedule</h2>

        {/* Frequency */}
        <div className="grid grid-cols-4 gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFrequency(f.value)}
              className={cn(
                "py-2 px-3 rounded-lg text-[13px] font-medium text-center border transition-all duration-150 cursor-pointer",
                frequency === f.value
                  ? "border-[--primary] bg-[--primary] text-white"
                  : "border-[--border] text-[--text-secondary] hover:border-[--border-strong]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Day selector (weekly only) */}
        {frequency === "weekly" && (
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
              Run on
            </label>
            <div className="flex gap-1.5">
              {DAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(index)}
                  className={cn(
                    "w-9 h-8 rounded-md text-xs font-semibold border transition-all duration-150",
                    days.includes(index)
                      ? "bg-[--primary] text-white border-[--primary]"
                      : "border-[--border] text-[--text-secondary] hover:border-[--border-strong]",
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Time picker */}
        {frequency !== "manual" && (
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.06em] mb-2">
              At
            </label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="09:00 AM"
              className="w-32 h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
            />
          </div>
        )}
      </section>

      {/* Section 4 — Options */}
      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-[--text-primary] tracking-tight mb-4">Options</h2>
        <div>
          <ToggleRow
            label="Identify themes and patterns"
            checked={options.identify_themes}
            onChange={() => toggleOption("identify_themes")}
          />
          <ToggleRow
            label="Analyze sentiment"
            checked={options.analyze_sentiment}
            onChange={() => toggleOption("analyze_sentiment")}
          />
          <ToggleRow
            label="Auto-generate task drafts"
            checked={options.auto_generate_tasks}
            onChange={() => toggleOption("auto_generate_tasks")}
          />
          <ToggleRow
            label="Notify team on completion"
            checked={options.notify_team}
            onChange={() => toggleOption("notify_team")}
            last
          />
        </div>
      </section>

      {/* Section 5 — Summary */}
      <section className="mt-8">
        <div className="bg-[--surface-alt] border border-[--border]/60 rounded-xl p-4">
          <p className="text-[13px] text-[--text-secondary] italic">{summary}</p>
        </div>
      </section>

      {/* Footer */}
      <div className="mt-8 pt-5 border-t border-[--border]/60 flex items-center justify-between">
        <div>
          {!isNew && (
            <button
              type="button"
              onClick={() => console.log("delete workflow")}
              className="text-sm text-[--error] hover:underline"
            >
              Delete workflow
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/workflows")}
            className="h-9 px-4 rounded-lg border border-[--border] text-sm font-medium text-[--text-secondary] hover:bg-[--surface-alt] hover:border-[--border-strong] transition-all duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-9 px-4 rounded-lg bg-[--primary] text-[--primary-text] text-sm font-medium hover:bg-[--primary-hover] transition-colors"
          >
            Save Workflow
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  last,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3",
        !last && "border-b border-[--border]/60",
      )}
    >
      <span className="text-[14px] text-[--text-primary]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          "relative w-10 h-[22px] rounded-full transition-colors shrink-0",
          checked ? "bg-[--primary]" : "bg-[--border-strong]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-[18px]",
          )}
        />
      </button>
    </div>
  );
}
