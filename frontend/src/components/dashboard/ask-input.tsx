"use client";

import { useState } from "react";

interface AskInputProps {
  onSubmit: (query: string) => void;
  onAttachClick?: () => void;
  disabled?: boolean;
}

export function AskInput({ onSubmit, onAttachClick, disabled }: AskInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative flex items-center bg-surface border border-border rounded-2xl px-4 py-3.5 transition-colors focus-within:border-muted">
        {/* Attach / + button */}
        {onAttachClick && (
          <button
            type="button"
            onClick={onAttachClick}
            disabled={disabled}
            className="mr-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-foreground/10 text-muted hover:text-foreground transition-colors disabled:opacity-30"
            title="Attach feedback files"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}

        <input
          type="text"
          placeholder="Paste feedback or describe what you're hearing..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          className="flex-1 bg-transparent text-foreground placeholder:text-muted text-sm outline-none"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="ml-3 w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
          </svg>
        </button>
      </div>
    </form>
  );
}
