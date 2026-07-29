"use client";

import * as React from "react";
import { UploadCloud, FileIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils/format";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSizeBytes?: number;
  disabled?: boolean;
  className?: string;
  progress?: number;
  isUploading?: boolean;
}

export function FileUpload({
  onUpload,
  accept,
  maxSizeBytes,
  disabled = false,
  className,
  progress,
  isUploading = false,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function validateAndStage(file: File) {
    setError(null);
    if (maxSizeBytes && file.size > maxSizeBytes) {
      setError(`File exceeds the maximum size of ${formatFileSize(maxSizeBytes)}.`);
      return;
    }
    setPendingFile(file);
  }

  async function handleUpload() {
    if (!pendingFile) return;
    try {
      await onUpload(pendingFile);
      setPendingFile(null);
    } catch {
      // Errors are surfaced by the caller via toast; keep the file staged for retry.
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          const file = event.dataTransfer.files?.[0];
          if (file) validateAndStage(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <UploadCloud className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
        <p className="text-xs text-muted-foreground">
          {maxSizeBytes ? `Maximum file size: ${formatFileSize(maxSizeBytes)}` : "Any file type"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) validateAndStage(file);
            event.target.value = "";
          }}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {pendingFile ? (
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <FileIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{pendingFile.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(pendingFile.size)}</p>
            {isUploading && typeof progress === "number" ? (
              <Progress value={progress} className="mt-2 h-1.5" />
            ) : null}
          </div>
          {!isUploading ? (
            <>
              <Button size="sm" onClick={handleUpload}>
                Upload
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => setPendingFile(null)}>
                <X className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
