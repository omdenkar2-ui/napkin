"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { extractTextsFromFile } from "@/lib/parse-feedback-files";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileWithPreview {
  id: string;
  file: File;
  preview?: string; // object URL for images
  type: string;
  uploadStatus: "pending" | "complete";
  textContent?: string; // first 200 chars for text files
}

interface PastedContent {
  id: string;
  content: string;
  wordCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_APP_MIMES = new Set([
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/csv",
]);
const TEXT_EXTS = new Set([
  "txt", "md", "csv", "json", "jsonl", "tsv",
  "py", "js", "ts", "jsx", "tsx", "html", "xml", "yaml", "yml",
]);

function isTextualFile(file: File): boolean {
  if (TEXT_MIME_PREFIXES.some((p) => file.type.startsWith(p))) return true;
  if (TEXT_APP_MIMES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTS.has(ext);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function getFileExtension(filename: string): string {
  return (filename.split(".").pop()?.toUpperCase() ?? "FILE").slice(0, 8);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TextualFilePreviewCard({
  file,
  onRemove,
}: {
  file: FileWithPreview;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative group rounded-lg w-[125px] h-[125px] flex-shrink-0 overflow-hidden bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)]">
      <div className="text-[8px] text-[rgba(255,255,255,0.45)] whitespace-pre-wrap break-words p-2.5 overflow-hidden h-full leading-tight">
        {file.textContent ?? "Loading..."}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#161614] flex items-end p-2 pointer-events-none">
        <span className="text-[10px] font-medium text-white uppercase bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.12)] px-2 py-0.5 rounded-md">
          {getFileExtension(file.file.name)}
        </span>
      </div>

      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          className="w-5 h-5 rounded-full bg-[rgba(0,0,0,0.7)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center hover:bg-[rgba(0,0,0,0.9)] transition-colors"
          title="Remove"
        >
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function GenericFilePreviewCard({
  file,
  onRemove,
}: {
  file: FileWithPreview;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative group rounded-lg w-[125px] h-[125px] flex-shrink-0 overflow-hidden bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)]">
      {file.type.startsWith("image/") && file.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.preview}
          alt={file.file.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-start justify-start p-2.5 h-full overflow-hidden">
          <p className="text-xs font-medium text-foreground truncate max-w-full" title={file.file.name}>
            {file.file.name}
          </p>
          <p className="text-[10px] text-text-ghost mt-1">
            {formatFileSize(file.file.size)}
          </p>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#161614] flex items-end p-2 pointer-events-none">
        <span className="text-[10px] font-medium text-white uppercase bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.12)] px-2 py-0.5 rounded-md">
          {getFileExtension(file.file.name)}
        </span>
      </div>

      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          className="w-5 h-5 rounded-full bg-[rgba(0,0,0,0.7)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center hover:bg-[rgba(0,0,0,0.9)] transition-colors"
          title="Remove"
        >
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function PastedContentCard({
  content,
  onRemove,
}: {
  content: PastedContent;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative group rounded-lg w-[125px] h-[125px] flex-shrink-0 overflow-hidden bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)]">
      <div className="text-[8px] text-[rgba(255,255,255,0.45)] whitespace-pre-wrap break-words p-2.5 overflow-hidden h-full leading-tight">
        {content.content.slice(0, 150)}
        {content.content.length > 150 && "..."}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#161614] flex items-end p-2 pointer-events-none">
        <span className="text-[10px] font-medium text-white uppercase bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.12)] px-2 py-0.5 rounded-md">
          PASTED
        </span>
      </div>

      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(content.content)}
          className="w-5 h-5 rounded-full bg-[rgba(0,0,0,0.7)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center hover:bg-[rgba(0,0,0,0.9)] transition-colors"
          title="Copy"
        >
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onRemove(content.id)}
          className="w-5 h-5 rounded-full bg-[rgba(0,0,0,0.7)] border border-[rgba(255,255,255,0.15)] flex items-center justify-center hover:bg-[rgba(0,0,0,0.9)] transition-colors"
          title="Remove"
        >
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function FilePreviewCard({
  file,
  onRemove,
}: {
  file: FileWithPreview;
  onRemove: (id: string) => void;
}) {
  if (isTextualFile(file.file)) {
    return <TextualFilePreviewCard file={file} onRemove={onRemove} />;
  }
  return <GenericFilePreviewCard file={file} onRemove={onRemove} />;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FeedbackInputRef {
  fillText: (text: string) => void;
  openFilePicker: () => void;
  focusTextarea: () => void;
}

export interface FeedbackInputProps {
  onSubmit: (texts: string[]) => Promise<void>;
  placeholder?: string;
  minTextareaHeight?: string;
  className?: string;
  disabled?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const FeedbackInput = forwardRef<FeedbackInputRef, FeedbackInputProps>(
  function FeedbackInput(
    {
      onSubmit,
      placeholder = "Paste customer feedback here...",
      minTextareaHeight = "120px",
      className,
      disabled = false,
    },
    ref,
  ) {
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<FileWithPreview[]>([]);
    const [pastedContent, setPastedContent] = useState<PastedContent[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      fillText: (text: string) => setMessage(text),
      openFilePicker: () => fileInputRef.current?.click(),
      focusTextarea: () => textareaRef.current?.focus(),
    }));

    // Auto-resize textarea
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 300) + "px";
    }, [message]);

    // ── File handling ──────────────────────────────────────────────────────────

    const handleFileSelect = useCallback(
      async (fileList: FileList | null) => {
        if (!fileList) return;
        const incoming = Array.from(fileList).slice(0, 10 - files.length);

        const newFiles: FileWithPreview[] = await Promise.all(
          incoming.map(async (file) => {
            const fwp: FileWithPreview = {
              id: `${file.name}-${file.size}-${Date.now()}`,
              file,
              type: file.type,
              uploadStatus: "pending",
            };

            if (file.type.startsWith("image/")) {
              fwp.preview = URL.createObjectURL(file);
            } else if (isTextualFile(file)) {
              try {
                const text = await readFileAsText(file);
                fwp.textContent = text.slice(0, 200);
              } catch {
                fwp.textContent = "";
              }
            }

            fwp.uploadStatus = "complete";
            return fwp;
          }),
        );

        setFiles((prev) => {
          const existingIds = new Set(prev.map((f) => f.file.name + f.file.size));
          return [...prev, ...newFiles.filter((f) => !existingIds.has(f.file.name + f.file.size))];
        });
      },
      [files.length],
    );

    const handleRemoveFile = useCallback((id: string) => {
      setFiles((prev) => {
        const target = prev.find((f) => f.id === id);
        if (target?.preview) URL.revokeObjectURL(target.preview);
        return prev.filter((f) => f.id !== id);
      });
    }, []);

    // ── Event handlers ─────────────────────────────────────────────────────────

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // Check for file items
      const fileItems = Array.from(e.clipboardData.items).filter(
        (item) => item.kind === "file",
      );
      if (fileItems.length > 0) {
        const pastedFiles = fileItems
          .map((item) => item.getAsFile())
          .filter(Boolean) as File[];
        if (pastedFiles.length > 0) {
          e.preventDefault();
          const dt = new DataTransfer();
          pastedFiles.forEach((f) => dt.items.add(f));
          await handleFileSelect(dt.files);
          return;
        }
      }

      // Large text paste → card
      const pastedText = e.clipboardData.getData("text");
      if (pastedText.length > 500) {
        e.preventDefault();
        const wordCount = pastedText.trim().split(/\s+/).length;
        setPastedContent((prev) => [
          ...prev,
          { id: Date.now().toString(), content: pastedText, wordCount },
        ]);
        setMessage((prev) => {
          const snippet = pastedText.slice(0, 100) + "...";
          return prev ? `${prev} ${snippet}` : snippet;
        });
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      // Only clear if leaving the container entirely
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
      }
    };
    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        await handleFileSelect(e.dataTransfer.files);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend && !disabled) void handleSubmit();
      }
    };

    const handleSubmit = async () => {
      if (!canSend || isSubmitting || disabled) return;
      setIsSubmitting(true);
      try {
        const allTexts: string[] = [];
        if (message.trim()) {
          allTexts.push(...message.split(/\n\n+/).filter((t) => t.trim()));
        }
        for (const fwp of files) {
          allTexts.push(...(await extractTextsFromFile(fwp.file)));
        }
        for (const p of pastedContent) {
          allTexts.push(p.content);
        }
        await onSubmit(allTexts.filter(Boolean));
        // Clear state on success
        setMessage("");
        setFiles([]);
        setPastedContent([]);
      } catch {
        // Parent threw — keep state, reset submitting
        setIsSubmitting(false);
      }
    };

    const canSend =
      message.trim().length > 0 ||
      files.length > 0 ||
      pastedContent.length > 0;

    const hasFilePreviews = files.length > 0 || pastedContent.length > 0;

    return (
      <div
        className={cn("relative w-full max-w-2xl mx-auto", className)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-[rgba(255,255,255,0.03)] border-2 border-dashed border-[rgba(255,255,255,0.20)] rounded-2xl flex items-center justify-center pointer-events-none">
            <p className="text-sm text-text-secondary">Drop files here</p>
          </div>
        )}

        {/* Main card */}
        <div
          className={cn(
            "bg-[#1c1c1a] border rounded-2xl shadow-lg flex flex-col min-h-[150px] transition-colors",
            isFocused
              ? "border-[rgba(255,255,255,0.15)]"
              : "border-[rgba(255,255,255,0.08)]",
          )}
        >
          {/* Section A: Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            style={{ minHeight: minTextareaHeight }}
            rows={1}
            className="flex-1 w-full p-4 bg-transparent border-none outline-none resize-none text-foreground text-sm leading-relaxed placeholder:text-text-tertiary max-h-[300px] disabled:opacity-50 focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Section B: Action Bar — NO border-top, blends with textarea */}
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || files.length >= 10}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSend || disabled}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-lg transition-all",
                  canSend && !disabled
                    ? "bg-white text-black hover:opacity-90 cursor-pointer"
                    : "bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.20)] cursor-not-allowed",
                )}
                title="Analyze feedback"
              >
                {isSubmitting ? (
                  <Spinner size="sm" className="text-black" />
                ) : (
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Section C: File preview strip — BELOW action bar */}
          {hasFilePreviews && (
            <div className="overflow-x-auto hide-scrollbar border-t border-[rgba(255,255,255,0.06)] p-3 bg-[#161614] rounded-b-2xl">
              <div className="flex gap-3">
                {pastedContent.map((pc) => (
                  <PastedContentCard
                    key={pc.id}
                    content={pc}
                    onRemove={(id) =>
                      setPastedContent((prev) => prev.filter((c) => c.id !== id))
                    }
                  />
                ))}
                {files.map((fwp) => (
                  <FilePreviewCard
                    key={fwp.id}
                    file={fwp}
                    onRemove={handleRemoveFile}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".json,.jsonl,.csv,.tsv,.txt,.md,.pdf,.docx"
          onChange={(e) => {
            void handleFileSelect(e.target.files);
            if (e.target) e.target.value = "";
          }}
        />
      </div>
    );
  },
);
