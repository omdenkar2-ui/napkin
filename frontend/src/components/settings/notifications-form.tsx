"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Channel = "email" | "inApp" | "slack";

interface NotificationRow {
  id: string;
  event: string;
  defaults: Record<Channel, boolean>;
}

const ROWS: NotificationRow[] = [
  { id: "analysis_completed", event: "Analysis completed", defaults: { email: true, inApp: true, slack: false } },
  { id: "tasks_ready", event: "Tasks ready for review", defaults: { email: true, inApp: true, slack: true } },
  { id: "new_feedback", event: "New feedback collected", defaults: { email: false, inApp: true, slack: false } },
  { id: "team_member_joined", event: "Team member joined", defaults: { email: true, inApp: true, slack: false } },
  { id: "workflow_failed", event: "Workflow failed", defaults: { email: true, inApp: true, slack: true } },
];

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "inApp", label: "In-app" },
  { key: "slack", label: "Slack" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
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
  );
}

export function NotificationsForm() {
  const [state, setState] = useState<Record<string, Record<Channel, boolean>>>(() => {
    const initial: Record<string, Record<Channel, boolean>> = {};
    for (const row of ROWS) {
      initial[row.id] = { ...row.defaults };
    }
    return initial;
  });

  function toggle(rowId: string, channel: Channel) {
    setState((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [channel]: !prev[rowId][channel] },
    }));
  }

  return (
    <div>
      <h3 className="text-[16px] font-semibold text-[--text-primary] tracking-tight mb-1">Notifications</h3>
      <p className="text-[13px] text-[--text-muted] mb-6">Choose how you want to be notified</p>

      <div className="bg-[--surface] border border-[--border] rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center h-11 px-5 bg-[--surface-alt]">
          <span className="flex-1 text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">Event</span>
          {CHANNELS.map((ch) => (
            <span key={ch.key} className="w-20 text-center text-[11px] font-semibold text-[--text-muted] uppercase tracking-[0.08em]">
              {ch.label}
            </span>
          ))}
        </div>

        {/* Rows */}
        {ROWS.map((row, index) => (
          <div
            key={row.id}
            className={cn(
              "flex items-center h-[52px] px-5",
              index < ROWS.length - 1 && "border-b border-[--border]/60",
            )}
          >
            <span className="flex-1 text-[13px] text-[--text-primary]">{row.event}</span>
            {CHANNELS.map((ch) => (
              <div key={ch.key} className="w-20 flex justify-center">
                <Toggle
                  checked={state[row.id][ch.key]}
                  onChange={() => toggle(row.id, ch.key)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => toast.success("Notification preferences saved")}
          className="h-9 px-4 rounded-lg bg-[--primary] text-[--primary-text] text-sm font-medium hover:bg-[--primary-hover] transition-colors"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}
