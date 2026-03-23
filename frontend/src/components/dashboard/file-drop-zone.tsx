"use client";

import { cn } from "@/lib/utils";
import { FileCard } from "./file-card";
import type { UploadedFile } from "@/hooks/use-file-upload";

interface FileDropZoneProps {
  isDragging: boolean;
  files: UploadedFile[];
  uploading: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function FileDropZone({
  isDragging,
  files,
  uploading,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: FileDropZoneProps) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "fixed inset-0 z-30 pointer-events-none transition-colors duration-200",
        isDragging && "pointer-events-auto bg-accent/5 border-2 border-dashed border-accent/40",
      )}
    >
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-16 h-16 text-accent-light mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-lg text-foreground">Drop your files here</p>
            <p className="text-sm text-muted mt-1">CSV, TXT, DOCX, or PDF</p>
          </div>
        </div>
      )}

      {/* Floating file cards in bottom-right */}
      {!isDragging && files.length === 0 && (
        <div className="absolute bottom-12 right-12 pointer-events-none">
          <p className="text-sm text-muted italic font-handwritten text-right mb-2">
            drag your data here
          </p>
          <svg className="w-24 h-12 text-muted/30 ml-auto" viewBox="0 0 96 48" fill="none">
            <path d="M80 4C60 4 40 20 20 40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
            <path d="M24 32L20 40L28 38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Show uploaded files */}
      {files.length > 0 && !isDragging && (
        <div className="absolute bottom-12 right-12 flex flex-col gap-2 items-end pointer-events-none">
          {files.map((file, i) => (
            <FileCard key={i} name={file.name} type={file.type} />
          ))}
        </div>
      )}

      {uploading && (
        <div className="absolute bottom-12 right-12 text-sm text-muted animate-pulse">
          Uploading...
        </div>
      )}
    </div>
  );
}
