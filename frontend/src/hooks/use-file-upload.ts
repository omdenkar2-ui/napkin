"use client";

import { useState, useCallback, useRef } from "react";
import { uploadFeedbackFile } from "@/lib/api/sessions";
import { toast } from "sonner";

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
}

const ACCEPTED_TYPES = [
  "text/csv",
  "text/plain",
  "text/markdown",
  "text/tab-separated-values",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
];

const ACCEPTED_EXTENSIONS = [".csv", ".txt", ".md", ".tsv", ".json", ".jsonl", ".docx", ".pdf"];

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
}

function getFileExtension(name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() || "FILE";
  return `.${ext}`;
}

export function useFileUpload(projectId: string | null) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const uploadFiles = useCallback(
    async (fileList: File[]) => {
      if (!projectId) {
        toast.error("Project not ready yet");
        return;
      }

      const validFiles = fileList.filter(isAcceptedFile);
      if (validFiles.length === 0) {
        toast.error("Please upload CSV, TXT, JSON, PDF, DOCX, or other supported files");
        return;
      }

      setUploading(true);
      const newFiles: UploadedFile[] = [];

      for (const file of validFiles) {
        try {
          await uploadFeedbackFile(projectId, file);
          newFiles.push({
            name: file.name,
            type: getFileExtension(file.name),
            size: file.size,
          });
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      setFiles((prev) => [...prev, ...newFiles]);
      setUploading(false);

      if (newFiles.length > 0) {
        toast.success(
          `${newFiles.length} file${newFiles.length > 1 ? "s" : ""} uploaded`,
        );
      }
    },
    [projectId],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const droppedFiles = Array.from(e.dataTransfer.files);
      await uploadFiles(droppedFiles);
    },
    [uploadFiles],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      await uploadFiles(selectedFiles);
      e.target.value = "";
    },
    [uploadFiles],
  );

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  return {
    isDragging,
    files,
    uploading,
    fileCount: files.length,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    clearFiles,
  };
}
