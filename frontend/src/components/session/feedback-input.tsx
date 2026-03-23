"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackInputProps {
  onSubmit: (texts: string[]) => void;
  loading?: boolean;
}

export function FeedbackInput({ onSubmit, loading }: FeedbackInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const texts = text
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    if (texts.length === 0) return;
    onSubmit(texts);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder={"Paste customer feedback here...\nOne piece of feedback per line, or paste a block of text."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={5}
        className="min-h-[120px]"
        disabled={loading}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {text.split("\n").filter(Boolean).length} items &middot; Cmd+Enter to submit
        </p>
        <Button type="submit" disabled={loading || !text.trim()}>
          {loading ? "Processing..." : "Analyze feedback"}
        </Button>
      </div>
    </form>
  );
}
