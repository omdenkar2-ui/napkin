"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link2, ExternalLink, Trash2 } from "lucide-react";
import { EmojiPicker, EmojiPickerSearch, EmojiPickerContent } from "@/components/ui/emoji-picker";
import { IconPicker, SESSION_ICONS } from "@/components/ui/icon-picker";
import { SessionIcon } from "@/components/ui/session-icon";
import { cn } from "@/lib/utils";

type CardStatus = "processing" | "patterns_ready" | "spec_ready" | "no_patterns";

export interface SessionCardSession {
  id: string;
  title: string;
  emoji: string;
  status: CardStatus;
  feedbackCount: number;
  createdAt: string;
}

export interface SessionCardProps {
  session: SessionCardSession;
  onClick: () => void;
  onEmojiChange: (id: string, emoji: string) => void;
  onDelete: (id: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; containerClass: string; dotClass?: string; pulse?: boolean }> = {
    spec_ready:     { label: "Spec ready",      containerClass: "bg-[rgba(34,197,94,0.12)] text-[rgba(134,239,172,0.90)] border border-[rgba(34,197,94,0.20)]",     dotClass: "bg-[#22c55e]" },
    completed:      { label: "Spec ready",      containerClass: "bg-[rgba(34,197,94,0.12)] text-[rgba(134,239,172,0.90)] border border-[rgba(34,197,94,0.20)]",     dotClass: "bg-[#22c55e]" },
    ready:          { label: "Ready",           containerClass: "bg-[rgba(34,197,94,0.12)] text-[rgba(134,239,172,0.90)] border border-[rgba(34,197,94,0.20)]",     dotClass: "bg-[#22c55e]" },
    processing:     { label: "Processing…",     containerClass: "bg-[rgba(251,146,60,0.12)] text-[rgba(253,186,116,0.90)] border border-[rgba(251,146,60,0.20)]",   dotClass: "bg-[#fb923c]", pulse: true },
    in_review:      { label: "In review",       containerClass: "bg-[rgba(251,146,60,0.12)] text-[rgba(253,186,116,0.90)] border border-[rgba(251,146,60,0.20)]",   dotClass: "bg-[#fb923c]", pulse: true },
    review:         { label: "In review",       containerClass: "bg-[rgba(251,146,60,0.12)] text-[rgba(253,186,116,0.90)] border border-[rgba(251,146,60,0.20)]",   dotClass: "bg-[#fb923c]", pulse: true },
    patterns_ready: { label: "Patterns ready",  containerClass: "bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.70)] border border-[rgba(255,255,255,0.10)]", dotClass: "bg-[rgba(255,255,255,0.50)]" },
    no_patterns:    { label: "No patterns",     containerClass: "bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.30)] border border-[rgba(255,255,255,0.07)]" },
    archived:       { label: "Archived",        containerClass: "bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.28)] border border-[rgba(255,255,255,0.07)]" },
    archive:        { label: "Archived",        containerClass: "bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.28)] border border-[rgba(255,255,255,0.07)]" },
  };

  const c = config[status] ?? config["no_patterns"];

  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-flex items-center gap-1.5 w-fit", c.containerClass)}>
      {c.dotClass && (
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", c.dotClass, c.pulse && "animate-pulse")} />
      )}
      {c.label}
    </span>
  );
}

function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors text-left",
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-[rgba(255,255,255,0.72)] hover:bg-[rgba(255,255,255,0.06)]"
      )}
    >
      <span className="w-4 h-4 flex items-center justify-center opacity-70">{icon}</span>
      {label}
    </button>
  );
}

export function SessionCard({ session, onClick, onEmojiChange, onDelete }: SessionCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"emoji" | "icons">("emoji");
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const emojiRef = useRef<HTMLSpanElement>(null);

  return (
    <div
      onClick={(e) => {
        if (pickerOpen) return;
        const target = e.target as HTMLElement;
        if (
          target.closest("[data-menu]") ||
          target.closest("[data-emoji]") ||
          target.closest('[data-slot="emoji-picker"]') ||
          target.closest('[data-slot="emoji-picker-search"]') ||
          target.closest('[data-slot="emoji-picker-viewport"]') ||
          target.closest('[data-slot="emoji-picker-list"]')
        ) return;
        onClick();
      }}
      className="relative flex flex-col gap-3 bg-[#161618] border border-[rgba(255,255,255,0.09)] rounded-2xl p-5 cursor-pointer hover:bg-[#1c1c1e] hover:border-[rgba(255,255,255,0.15)] transition-colors min-h-[160px]"
    >
      {/* 3-dot button */}
      <button
        data-menu="trigger"
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMenuOpen((prev) => !prev); }}
        className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-[rgba(255,255,255,0.30)] hover:text-[rgba(255,255,255,0.80)] hover:bg-[rgba(255,255,255,0.08)] transition-all cursor-pointer select-none"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
          <circle cx="7.5" cy="2.5" r="1.5" />
          <circle cx="7.5" cy="7.5" r="1.5" />
          <circle cx="7.5" cy="12.5" r="1.5" />
        </svg>
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMenuOpen(false); }} />
            <motion.div
              data-menu="dropdown"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.10 }}
              className="absolute top-10 right-3 z-50 min-w-[160px] bg-[#1c1c1a] border border-[rgba(255,255,255,0.10)] rounded-xl shadow-2xl overflow-hidden py-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <MenuItem
                icon={<Link2 size={13} />}
                label="Copy link"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/s/${session.id}`);
                  setMenuOpen(false);
                }}
              />
              <MenuItem
                icon={<ExternalLink size={13} />}
                label="Open in new tab"
                onClick={() => {
                  window.open(`/s/${session.id}`, "_blank");
                  setMenuOpen(false);
                }}
              />
              <div className="h-px bg-[rgba(255,255,255,0.07)] my-1" />
              <MenuItem
                icon={<Trash2 size={13} />}
                label="Delete"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(session.id);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Emoji area */}
      <div className="relative">
        <span
          ref={emojiRef}
          data-emoji="trigger"
          className="cursor-pointer hover:scale-110 transition-transform inline-flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            if (emojiRef.current) {
              const rect = emojiRef.current.getBoundingClientRect();
              const clampedLeft = Math.min(rect.left, window.innerWidth - 328);
              setPickerPos({ top: rect.bottom + 8, left: Math.max(8, clampedLeft) });
            }
            setPickerOpen(prev => !prev);
            setPickerTab("emoji");
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <SessionIcon value={session.emoji} size={38} />
        </span>
        <AnimatePresence>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPickerOpen(false); }} />
              <motion.div
                data-emoji="popover"
                style={{ top: pickerPos.top, left: pickerPos.left, zIndex: 9999 }}
                className="fixed rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_8px_32px_rgba(0,0,0,0.60)] bg-[#1c1c1a]"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12 }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
              >
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-2 pt-2 pb-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPickerTab("emoji"); }}
                    className={cn(
                      "flex-1 h-7 rounded-lg text-[12px] font-medium transition-colors",
                      pickerTab === "emoji"
                        ? "bg-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.90)]"
                        : "text-[rgba(255,255,255,0.40)] hover:text-[rgba(255,255,255,0.70)] hover:bg-[rgba(255,255,255,0.05)]"
                    )}
                  >
                    Emoji
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPickerTab("icons"); }}
                    className={cn(
                      "flex-1 h-7 rounded-lg text-[12px] font-medium transition-colors",
                      pickerTab === "icons"
                        ? "bg-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.90)]"
                        : "text-[rgba(255,255,255,0.40)] hover:text-[rgba(255,255,255,0.70)] hover:bg-[rgba(255,255,255,0.05)]"
                    )}
                  >
                    Icons
                  </button>
                </div>

                {/* Tab content */}
                {pickerTab === "emoji" ? (
                  <EmojiPicker
                    className="h-[268px] w-[320px]"
                    onEmojiSelect={({ emoji }) => {
                      onEmojiChange(session.id, emoji);
                      setPickerOpen(false);
                    }}
                  >
                    <EmojiPickerSearch />
                    <EmojiPickerContent />
                  </EmojiPicker>
                ) : (
                  <div
                    className="w-[320px] h-[268px] overflow-y-auto [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: "none" }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconPicker
                      onIconSelect={(iconName) => {
                        onEmojiChange(session.id, iconName);
                        setPickerOpen(false);
                      }}
                      selectedIcon={SESSION_ICONS.find(i => i.name === session.emoji) ? session.emoji : undefined}
                    />
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Title */}
      <p className="text-[15px] font-semibold text-[rgba(255,255,255,0.88)] leading-snug line-clamp-2 mt-1">
        {session.title}
      </p>

      {/* Status badge */}
      <StatusBadge status={session.status} />

      {/* Footer */}
      <div className="flex flex-col gap-0.5 mt-auto pt-1">
        <span className="text-[11px] text-[rgba(255,255,255,0.30)]">
          {session.feedbackCount} feedback{session.feedbackCount !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] font-medium text-[rgba(255,255,255,0.38)]">
          {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(session.createdAt))}
        </span>
      </div>
    </div>
  );
}
