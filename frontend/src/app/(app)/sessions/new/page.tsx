"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Hash,
  MessageCircle,
  FileText,
  BookOpen,
  Video,
  Mail,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { SourceSelectCard, type SourceOption } from "@/components/sessions/source-select-card";
import { FileDropZone, type UploadedFile } from "@/components/sessions/file-drop-zone";
import { cn } from "@/lib/utils";
import { useProject } from "@/providers/project-provider";
import { createSession, parseFile } from "@/lib/api/sessions";

const SOURCES: SourceOption[] = [
  { id: "slack", name: "Slack", icon: Hash, iconBg: "bg-[#E8D5F5]", iconColor: "text-[#611F69]", itemCount: "1,247 items", enabled: true },
  { id: "intercom", name: "Intercom", icon: MessageCircle, iconBg: "bg-[#E0F0FF]", iconColor: "text-[#1F8DED]", itemCount: "892 items", enabled: true },
  { id: "typeform", name: "Typeform", icon: FileText, iconBg: "bg-[#E8E8E8]", iconColor: "text-[#262627]", itemCount: "234 items", enabled: false },
  { id: "notion", name: "Notion", icon: BookOpen, iconBg: "bg-[#F0F0F0]", iconColor: "text-[#1A1A1A]", itemCount: "156 items", enabled: true },
  { id: "zoom", name: "Zoom", icon: Video, iconBg: "bg-[#E0EDFF]", iconColor: "text-[#2D8CFF]", itemCount: "45 transcripts", enabled: false },
  { id: "email", name: "Email", icon: Mail, iconBg: "bg-[#FFF3E0]", iconColor: "text-[#E67E22]", itemCount: "78 items", enabled: false },
];

export default function NewSessionPage() {
  const router = useRouter();
  const { projectId } = useProject();
  const [sessionName, setSessionName] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatText, setChatText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [options, setOptions] = useState({
    identify_patterns: true,
    analyze_sentiment: true,
    auto_generate_tasks: false,
  });

  const canStart = (selectedSources.length > 0 || uploadedFiles.length > 0 || chatText.trim().length > 0) && !isSubmitting;

  const toggleSource = useCallback((id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }, []);

  const handleFilesAdd = useCallback((files: UploadedFile[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  }, []);

  const handleFileRemove = useCallback((id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const toggleOption = useCallback((key: keyof typeof options) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  async function handleStart() {
    if (!projectId) {
      toast.error("No project loaded. Please refresh the page.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Parse pasted text into individual lines
      const pastedTexts = chatText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // 2. Parse uploaded files on the backend — extract feedback text
      const fileTexts: string[] = [];
      for (const uf of uploadedFiles) {
        if (uf.file) {
          try {
            const parsed = await parseFile(uf.file);
            fileTexts.push(...parsed.texts);
          } catch {
            toast.error(`Failed to parse ${uf.name}`);
          }
        }
      }

      // 3. Combine everything
      const allTexts = [...pastedTexts, ...fileTexts];

      if (allTexts.length === 0) {
        toast.error("No feedback found. Paste text or upload a file with feedback data.");
        setIsSubmitting(false);
        return;
      }

      // 4. Create session with ALL feedback — pipeline starts immediately
      const result = await createSession({
        project_id: projectId,
        title: sessionName || undefined,
        initial_feedback: { texts: allTexts },
      });

      toast.success(`Session started — analyzing ${allTexts.length} feedback items...`);
      router.push(`/sessions/${result.session_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
      setIsSubmitting(false);
    }
  }

  // Build summary text
  const sourceCount = selectedSources.length;
  const fileCount = uploadedFiles.length;
  let summaryText = "No data selected yet";
  if (sourceCount > 0 || fileCount > 0 || chatText.trim().length > 0) {
    const parts: string[] = [];
    if (sourceCount > 0) parts.push(`${sourceCount} source${sourceCount !== 1 ? "s" : ""} selected`);
    if (fileCount > 0) parts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""} uploaded`);
    if (chatText.trim().length > 0) parts.push("text feedback added");
    summaryText = parts.join(" \u00b7 ");
  }

  return (
    <div>
      {/* Page header */}
      <div className="h-14 border-b border-[#E5E2DC] flex items-center gap-3 px-8 bg-[--background]">
        <button
          type="button"
          onClick={() => router.push("/sessions")}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[--text-muted] hover:bg-[--surface-hover] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
          New Session
        </h1>
      </div>

      {/* Content */}
      <div className="max-w-[720px] mx-auto py-8 px-4 md:px-0">
        {/* Section 1 — Session Name */}
        <div>
          <label className="block text-[11px] font-semibold text-[#999999] uppercase tracking-[0.08em] mb-2">
            Session Name
          </label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="e.g., Weekly Product Feedback — Apr 9"
            autoFocus
            className="w-full h-9 px-3 rounded-lg border border-[--border] bg-[--surface] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--primary]/20 focus:border-[--primary] transition-colors"
          />
          <p className="text-[11px] text-[#999999] mt-1.5">
            Give this session a name to find it later
          </p>
        </div>

        {/* Section 2 — Data Sources */}
        <div className="mt-8">
          <h2 className="text-[16px] font-semibold text-[#1A1A1A] mb-1">Select Sources</h2>
          <p className="text-[13px] text-[#666666] mb-4">
            Choose which connected sources to include in this analysis.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SOURCES.map((source) => (
              <SourceSelectCard
                key={source.id}
                source={source}
                selected={selectedSources.includes(source.id)}
                onToggle={toggleSource}
              />
            ))}
          </div>
        </div>

        {/* Section 3 — Upload Documents */}
        <div className="mt-8">
          <h2 className="text-[16px] font-semibold text-[#1A1A1A] mb-1">Upload Documents</h2>
          <p className="text-[13px] text-[#666666] mb-4">
            Upload CSV, Excel, PDF, or text files with feedback data.
          </p>
          <FileDropZone
            files={uploadedFiles}
            onFilesAdd={handleFilesAdd}
            onFileRemove={handleFileRemove}
          />
        </div>

        {/* Section 4 — Or Use Chat */}
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setChatExpanded((prev) => !prev)}
            className={cn(
              "w-full flex items-center border rounded-xl p-5 text-left transition-colors cursor-pointer",
              chatExpanded
                ? "border-[#1B6B7A] bg-[#E8F4F6]/20"
                : "border-[#E5E2DC] bg-[#F5F3EF]/50 hover:border-[--border-strong]",
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-[#E8F4F6] flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-[#1B6B7A]" />
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[#1A1A1A]">
                Paste or describe your feedback
              </p>
              <p className="text-[12px] text-[#666666] mt-0.5">
                Use the chat interface to paste text, share context, or ask questions about your data.
              </p>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 text-[#999999] shrink-0 ml-3 transition-transform duration-150",
              chatExpanded && "rotate-90",
            )} />
          </button>
          {chatExpanded && (
            <div className="mt-3">
              <textarea
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Paste feedback text, interview notes, or describe your data..."
                className="w-full min-h-[120px] p-3 border border-[#E5E2DC] rounded-xl text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[#1B6B7A] focus:ring-1 focus:ring-[#1B6B7A]/20 focus:outline-none resize-y transition-colors"
              />
              <p className="text-[11px] text-[#999999] mt-1.5">
                This text will be included as additional context in your analysis.
              </p>
            </div>
          )}
        </div>

        {/* Section 5 — Analysis Options */}
        <div className="mt-8">
          <h2 className="text-[16px] font-semibold text-[#1A1A1A] mb-4">Options</h2>
          <div>
            <ToggleRow
              label="Identify patterns and themes"
              checked={options.identify_patterns}
              onToggle={() => toggleOption("identify_patterns")}
              hasBorder
            />
            <ToggleRow
              label="Analyze sentiment"
              checked={options.analyze_sentiment}
              onToggle={() => toggleOption("analyze_sentiment")}
              hasBorder
            />
            <ToggleRow
              label="Auto-generate task drafts"
              checked={options.auto_generate_tasks}
              onToggle={() => toggleOption("auto_generate_tasks")}
              hasBorder={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="pt-5 mt-8 border-t border-[#E5E2DC] flex items-center justify-between sticky bottom-0 bg-[#FCFBF9] pb-6">
          <p className="text-[13px] text-[#666666]">{summaryText}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/sessions")}
              className="h-9 px-4 rounded-lg border border-[--border] text-sm font-medium text-[--text-secondary] hover:bg-[--surface-alt] hover:border-[--border-strong] transition-all duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canStart}
              onClick={handleStart}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors",
                canStart
                  ? "bg-[#1B6B7A] text-white hover:bg-[--primary-hover] cursor-pointer"
                  : "bg-[#1B6B7A]/40 text-white/60 cursor-not-allowed",
              )}
            >
              <Sparkles className="w-4 h-4" />
              {isSubmitting ? "Starting..." : "Start Analysis"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onToggle,
  hasBorder,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  hasBorder: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3",
        hasBorder && "border-b border-[#E5E2DC]/60",
      )}
    >
      <span className="text-[14px] text-[#1A1A1A]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={cn(
          "relative w-10 h-[22px] rounded-full transition-colors duration-150 shrink-0",
          checked ? "bg-[#1B6B7A]" : "bg-[#D1CEC7]",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-150",
            checked && "translate-x-[18px]",
          )}
        />
      </button>
    </div>
  );
}
