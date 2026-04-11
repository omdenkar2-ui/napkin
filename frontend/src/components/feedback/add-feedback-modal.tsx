"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SOURCES = ["Customer call", "Email", "Meeting", "Other"];
const TAGS = ["Bug", "Feature Request", "UX", "Performance", "Praise", "Onboarding"];

interface AddFeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddFeedbackModal({ open, onClose }: AddFeedbackModalProps) {
  const [source, setSource] = useState("Customer call");
  const [customerName, setCustomerName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showError, setShowError] = useState(false);

  function reset() {
    setSource("Customer call");
    setCustomerName("");
    setFeedback("");
    setTags([]);
    setShowError(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!feedback.trim()) {
      setShowError(true);
      return;
    }
    console.log("Add feedback:", { source, customerName, feedback, tags });
    toast.success("Feedback added to inbox");
    reset();
    onClose();
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-lg">
      <DialogTitle>Add Feedback</DialogTitle>
      <DialogDescription className="text-[13px] text-[--text-muted]">
        Manually add a feedback item. It will be included in your next analysis.
      </DialogDescription>

      <div className="mt-6 flex flex-col gap-5">
        {/* Source */}
        <div>
          <label className="block text-[12px] font-medium text-[--text-muted] uppercase tracking-wider mb-1.5">
            Source
          </label>
          <div className="flex gap-2">
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={cn(
                  "border rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                  source === s
                    ? "border-[--primary] bg-[--primary-soft] text-[--primary]"
                    : "border-[--border] text-[--text-secondary] hover:border-[--border-strong]",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Customer name */}
        <div>
          <label className="block text-[12px] font-medium text-[--text-muted] uppercase tracking-wider mb-1.5">
            Customer name <span className="normal-case text-[--text-muted]">(optional)</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g., Sarah Chen"
            className="w-full h-9 px-3 rounded-md border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:border-[--border-focus] transition-colors"
          />
        </div>

        {/* Feedback text */}
        <div>
          <label className="block text-[12px] font-medium text-[--text-muted] uppercase tracking-wider mb-1.5">
            Feedback <span className="text-[--error]">*</span>
          </label>
          <textarea
            value={feedback}
            onChange={(e) => {
              if (e.target.value.length <= 2000) {
                setFeedback(e.target.value);
                if (showError && e.target.value.trim()) setShowError(false);
              }
            }}
            placeholder="What did the customer say?"
            rows={5}
            className={cn(
              "w-full px-3 py-2 rounded-md border bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none transition-colors resize-y min-h-[120px]",
              showError ? "border-[--error]" : "border-[--border] focus:border-[--border-focus]",
            )}
          />
          <p className="text-[11px] text-[--text-muted] text-right mt-1">
            {feedback.length} / 2000
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-[12px] font-medium text-[--text-muted] uppercase tracking-wider mb-1.5">
            Tags <span className="normal-case text-[--text-muted]">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  "border rounded-full px-2 py-1 text-[11px] font-medium cursor-pointer transition-colors",
                  tags.includes(tag)
                    ? "border-[--primary] bg-[--primary-soft] text-[--primary]"
                    : "border-[--border] text-[--text-secondary] hover:border-[--border-strong]",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-[--border] flex items-center justify-between">
        <span className="text-[11px] text-[--text-muted]">
          Feedback will appear in your inbox immediately
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 px-4 rounded-md border border-[--border] text-sm font-medium text-[--text-secondary] hover:bg-[--surface-hover] hover:border-[--border-strong] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[--primary] text-[--primary-text] text-sm font-medium hover:bg-[--primary-hover] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Feedback
          </button>
        </div>
      </div>
    </Dialog>
  );
}
