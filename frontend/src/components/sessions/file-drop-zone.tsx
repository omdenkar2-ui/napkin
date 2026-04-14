"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  file?: File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileDropZoneProps {
  files: UploadedFile[];
  onFilesAdd: (files: UploadedFile[]) => void;
  onFileRemove: (id: string) => void;
}

export function FileDropZone({ files, onFilesAdd, onFileRemove }: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: formatFileSize(f.size),
      type: f.type || f.name.split(".").pop() || "unknown",
      file: f,
    }));
    onFilesAdd(newFiles);
  }, [onFilesAdd]);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-150",
          dragOver
            ? "border-[#1B6B7A] bg-[#E8F4F6]/20"
            : "border-[#E5E2DC]",
        )}
      >
        <Upload className="w-8 h-8 text-[#999999] mx-auto" />
        <p className="text-[14px] font-medium text-[#4A4A4A] mt-3">
          Drag and drop files here
        </p>
        <p className="text-[12px] text-[#999999] my-2">or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[14px] font-medium text-[#1B6B7A] hover:underline cursor-pointer"
        >
          Browse files
        </button>
        <p className="text-[11px] text-[#999999] mt-3">
          CSV, XLSX, PDF, TXT, JSON, JSONL, TSV, DOCX — max 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.pdf,.txt,.json,.jsonl,.tsv,.md,.docx"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center py-2 px-3 bg-[#F5F3EF] rounded-lg"
            >
              <FileText className="w-4 h-4 text-[#666666] shrink-0" />
              <span className="text-[13px] text-[#1A1A1A] flex-1 ml-2 truncate">
                {file.name}
              </span>
              <span className="text-[12px] text-[#999999] mr-2 shrink-0">
                {file.size}
              </span>
              <button
                type="button"
                onClick={() => onFileRemove(file.id)}
                className="w-6 h-6 flex items-center justify-center rounded text-[#999999] hover:text-[#E13238] transition-colors shrink-0"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
