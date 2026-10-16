"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilePreviewPane } from "@/components/shared/file-preview-pane";
import { getFilePreviewKind } from "@/lib/utils/file-preview";
import type { CourseFile } from "@/types/course-file";

interface FileViewerDialogProps {
  file: CourseFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileViewerDialog({ file, open, onOpenChange }: FileViewerDialogProps) {
  const previewKind = file ? getFilePreviewKind(file.mimeType, file.originalName) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-full flex-col gap-3 rounded-none sm:h-[90vh] sm:max-w-[calc(100%-2rem)] sm:rounded-xl lg:max-w-6xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{file?.originalName ?? "File preview"}</DialogTitle>
          <DialogDescription>
            {previewKind === "pdf"
              ? "PDF preview"
              : previewKind === "pptx"
                ? "PowerPoint preview"
                : previewKind === "video"
                  ? "Video"
                  : "Preview"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
          {file ? <FilePreviewPane key={file.id} file={file} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
