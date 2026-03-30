"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/* ─── CSS for ColorOrb ─────────────────────────────────────────── */

const orbStyles = `
@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes spin {
  to { --angle: 360deg; }
}

.chat-orb {
  border-radius: 50%;
  background: oklch(15% 0 0);
  position: relative;
  flex-shrink: 0;
}

.chat-orb::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  background: conic-gradient(
    from var(--angle),
    oklch(40% 0 0) 0%,
    oklch(25% 0 0) 25%,
    oklch(40% 0 0) 50%,
    oklch(25% 0 0) 75%,
    oklch(40% 0 0) 100%
  );
  animation: spin 4s linear infinite;
  z-index: -1;
}

.chat-orb::after {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: 50%;
  background: oklch(15% 0 0);
  z-index: -1;
}
`;

/* ─── ColorOrb ─────────────────────────────────────────────────── */

function ColorOrb({ size = 20 }: { size?: number }) {
  return (
    <>
      <style>{orbStyles}</style>
      <div
        className="chat-orb"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    </>
  );
}

/* ─── Spring transition ────────────────────────────────────────── */

const SPRING = {
  type: "spring" as const,
  stiffness: 550,
  damping: 45,
  mass: 0.7,
};

const FORM_WIDTH = 360;
const FORM_HEIGHT = 210;

/* ─── SessionChatWidget ────────────────────────────────────────── */

export function SessionChatWidget() {
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Focus textarea when form opens */
  useEffect(() => {
    if (showForm) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showForm]);

  /* Click-outside to close */
  useEffect(() => {
    if (!showForm) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowForm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showForm]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!message.trim()) return;
    console.log("[ChatWidget] submitted: " + message);
    setMessage("");
    setShowForm(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setShowForm(false);
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  }

  const isActive = message.trim().length > 0;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <motion.div
        layout
        animate={{
          width: showForm ? FORM_WIDTH : "auto",
          height: showForm ? FORM_HEIGHT : 44,
          borderRadius: showForm ? 14 : 22,
        }}
        transition={{
          ...SPRING,
          delay: showForm ? 0 : 0.08,
        }}
        style={{
          background: "#1c1c1a",
          border: `1px solid ${showForm ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!showForm ? (
            /* ── Collapsed dock bar ── */
            <motion.div
              key="dock"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingLeft: 12,
                paddingRight: 12,
                height: 44,
                whiteSpace: "nowrap",
              }}
            >
              <ColorOrb size={20} />
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-[13px] font-medium text-[rgba(255,255,255,0.70)] hover:text-[rgba(255,255,255,0.90)] transition-colors px-2"
              >
                Ask AI
              </button>
            </motion.div>
          ) : (
            /* ── Expanded form ── */
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, delay: 0.05 }}
              style={{
                width: FORM_WIDTH,
                height: FORM_HEIGHT,
                position: "relative",
                padding: 4,
              }}
            >
              {/* ColorOrb — top-left */}
              <div style={{ position: "absolute", top: 8, left: 12, zIndex: 10 }}>
                <ColorOrb size={20} />
              </div>

              {/* "Ask AI" label */}
              <div
                style={{
                  position: "absolute",
                  top: 11,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <span className="text-[13px] text-[rgba(255,255,255,0.60)] ml-9">
                  Ask AI
                </span>
              </div>

              {/* Key hints — top-right */}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <kbd className="text-[rgba(255,255,255,0.28)] text-[11px] font-sans border border-[rgba(255,255,255,0.12)] rounded px-1.5 py-0.5">
                  ⌘
                </kbd>
                <kbd className="text-[rgba(255,255,255,0.28)] text-[11px] font-sans border border-[rgba(255,255,255,0.12)] rounded px-1.5 py-0.5">
                  Enter
                </kbd>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about this session..."
                className="w-full h-full resize-none bg-transparent outline-none text-[13px] text-[rgba(255,255,255,0.88)] placeholder:text-[rgba(255,255,255,0.28)] p-3 pt-8 scroll-py-2"
                style={{ display: "block" }}
              />

              {/* Submit button */}
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={!isActive}
                className={`h-7 px-3 rounded-md text-[12px] font-medium absolute bottom-2 right-2 transition-colors ${
                  isActive
                    ? "bg-white text-black"
                    : "bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.20)] cursor-not-allowed"
                }`}
              >
                Send
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default SessionChatWidget;
