"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createSession } from "@/lib/api/sessions";
import { toast } from "sonner";

interface NewAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string | null;
}

/**
 * Extract feedback texts from any file type.
 * Handles: JSON (array of objects with feedback_text/text/content/message/body),
 * CSV, TSV, TXT, and falls back to raw text for anything else.
 */
async function extractTextsFromFile(file: File): Promise<string[]> {
  const content = await file.text();
  const name = file.name.toLowerCase();

  // JSON — extract text from any common field name
  if (name.endsWith(".json") || name.endsWith(".jsonl")) {
    try {
      const textFields = [
        "feedback_text", "feedback", "text", "content", "message",
        "body", "comment", "review", "note", "description", "summary",
        "response", "input", "query", "question", "answer",
      ];

      // Handle JSONL (one JSON object per line)
      if (name.endsWith(".jsonl")) {
        return content
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            const obj = JSON.parse(line);
            for (const field of textFields) {
              if (obj[field] && typeof obj[field] === "string" && obj[field].trim()) {
                return obj[field].trim();
              }
            }
            return JSON.stringify(obj);
          })
          .filter(Boolean);
      }

      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      return items
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (typeof item === "object" && item !== null) {
            for (const field of textFields) {
              if (item[field] && typeof item[field] === "string" && item[field].trim()) {
                return item[field].trim();
              }
            }
            // If no known field, stringify the whole object
            return JSON.stringify(item);
          }
          return String(item);
        })
        .filter((t) => t && t.length > 0);
    } catch {
      // If JSON parse fails, treat as plain text
      return content.split("\n").filter((l) => l.trim().length > 0);
    }
  }

  // CSV / TSV — extract from common column names or concatenate all columns per row
  if (name.endsWith(".csv") || name.endsWith(".tsv")) {
    const separator = name.endsWith(".tsv") ? "\t" : ",";
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return lines;

    const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const textColNames = [
      "feedback_text", "feedback", "text", "content", "message",
      "body", "comment", "review", "note", "description",
    ];
    const textColIdx = headers.findIndex((h) => textColNames.includes(h));

    return lines.slice(1).map((line) => {
      const cols = line.split(separator).map((c) => c.trim().replace(/^["']|["']$/g, ""));
      if (textColIdx >= 0 && cols[textColIdx]) {
        return cols[textColIdx];
      }
      return cols.join(" | ");
    }).filter((t) => t.length > 0);
  }

  // TXT / MD / any other text — split by double newline or line
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const chunks = content.split(/\n\n+/).filter((c) => c.trim().length > 0);
    return chunks.length > 1 ? chunks : content.split("\n").filter((l) => l.trim().length > 0);
  }

  // Fallback — split by lines
  return content.split("\n").filter((l) => l.trim().length > 0);
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
  const [parseStatus, setParseStatus] = useState("");

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
      // Collect all texts: from pasted text + from files
      const allTexts: string[] = [];

      // Add pasted text (split by double newline for multiple items)
      if (feedbackText.trim()) {
        const pasted = feedbackText.split(/\n\n+/).filter((t) => t.trim());
        allTexts.push(...pasted);
      }

      // Parse all files client-side
      if (files.length > 0) {
        setParseStatus("Parsing files...");
        for (const file of files) {
          const texts = await extractTextsFromFile(file);
          allTexts.push(...texts);
        }
        setParseStatus(`Parsed ${allTexts.length} items. Starting analysis...`);
      }

      if (allTexts.length === 0) {
        toast.error("No feedback text found in the provided input");
        return;
      }

      // Create session with all extracted texts
      const result = await createSession({
        project_id: projectId,
        initial_feedback: { texts: allTexts },
      });

      toast.success(`Analysis started with ${allTexts.length} feedback items`);
      setFeedbackText("");
      setFiles([]);
      setParseStatus("");
      onClose();
      router.push(`/sessions/${result.session_id}`);
    } catch {
      toast.error("Failed to start analysis");
    } finally {
      setLoading(false);
      setParseStatus("");
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
            placeholder="Paste customer feedback here... (separate items with blank lines)"
            rows={4}
            className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-muted resize-none"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">
            Or upload files (JSON, CSV, TXT, JSONL, TSV, MD)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.jsonl,.csv,.tsv,.txt,.md,.docx,.pdf"
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

        {parseStatus && (
          <p className="text-xs text-accent">{parseStatus}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={(!feedbackText.trim() && files.length === 0) || loading}
          >
            {loading ? (parseStatus || "Starting...") : "Start analysis"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
