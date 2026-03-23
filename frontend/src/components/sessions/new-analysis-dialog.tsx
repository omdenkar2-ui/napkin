"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createSession, uploadFeedbackFile } from "@/lib/api/sessions";
import { toast } from "sonner";

interface NewAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string | null;
}

export function NewAnalysisDialog({
  open,
  onClose,
  projectId,
  projectName,
}: NewAnalysisDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() && files.length === 0) return;

    setLoading(true);
    try {
      // Upload files first if any
      for (const file of files) {
        await uploadFeedbackFile(projectId, file);
      }

      // Create session with text feedback if provided
      const result = await createSession({
        project_id: projectId,
        initial_feedback: feedbackText.trim()
          ? { texts: [feedbackText.trim()] }
          : undefined,
      });

      toast.success("Analysis started");
      setFeedbackText("");
      setFiles([]);
      onClose();
      router.push(`/sessions/${result.session_id}`);
    } catch {
      toast.error("Failed to start analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        New analysis{projectName ? ` — ${projectName}` : ""}
      </DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">
            Paste feedback
          </label>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Paste customer feedback here..."
            rows={4}
            className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-muted resize-none"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">
            Or upload files (CSV, TXT, DOCX, PDF)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.docx,.pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border border-dashed border-border rounded-lg px-3 py-3 text-sm text-muted hover:text-foreground hover:border-muted transition-colors"
          >
            {files.length > 0 ? (
              <span className="text-foreground">
                {files.map((f) => f.name).join(", ")}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Choose files
              </span>
            )}
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={(!feedbackText.trim() && files.length === 0) || loading}
          >
            {loading ? "Starting..." : "Start analysis"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
