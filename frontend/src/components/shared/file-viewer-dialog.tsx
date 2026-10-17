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
import type { PreviewFile } from "@/types/course-file";
import type { FileViewedResult } from "@/types/lesson";

interface FileViewerDialogProps {
  file: PreviewFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional title override, e.g. a study material's title instead of its filename. */
  label?: string;
  /** Student mode: record reaching the end of the file. */
  trackViewing?: boolean;
  onViewed?: (result: FileViewedResult) => void;
}

export function FileViewerDialog({
  file,
  open,
  onOpenChange,
  label,
  trackViewing = false,
  onViewed,
}: FileViewerDialogProps) {
  const previewKind = file ? getFilePreviewKind(file.mimeType, file.originalName) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-full flex-col gap-3 rounded-none sm:h-[90vh] sm:max-w-[calc(100%-2rem)] sm:rounded-xl lg:max-w-6xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{label ?? file?.originalName ?? "File preview"}</DialogTitle>
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
          {file ? (
            <FilePreviewPane key={file.id} file={file} trackViewing={trackViewing} onViewed={onViewed} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
