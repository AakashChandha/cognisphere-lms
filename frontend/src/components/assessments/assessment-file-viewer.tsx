"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { FileStreamUrl } from "@/types/course-file";
import type { AssessmentFileRef } from "@/types/assessment";
import { ApiError } from "@/types/api";

interface AssessmentFilePaneProps {
  file: AssessmentFileRef;
  /** Cache key for the signed URL; include the file id so switching files refetches. */
  queryKey: readonly unknown[];
  loadStreamUrl: () => Promise<FileStreamUrl>;
  className?: string;
}

/**
 * View-only PDF pane for question papers and submissions. Mirrors the
 * course-file preview: a signed, same-origin URL in an `<iframe>` with the
 * built-in toolbar hidden, so there is no download or print affordance.
 * Papers and submissions are PDF-only by contract, so no other kind is handled.
 */
export function AssessmentFilePane({ file, queryKey, loadStreamUrl, className }: AssessmentFilePaneProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: loadStreamUrl,
    // A signed token is short-lived: never serve a stale one from the cache.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className={cn("flex h-full min-h-96 flex-col gap-3 p-4", className)}>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="min-h-80 w-full flex-1" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={cn("flex h-full min-h-96 flex-col items-center justify-center gap-3 p-6 text-center", className)}>
        <FileWarning className="size-10 text-amber-500" />
        <p className="max-w-md text-sm text-muted-foreground">
          {error instanceof ApiError ? error.message : "This file could not be opened."}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <iframe
      title={file.originalName}
      src={`${data.url}#toolbar=0`}
      className={cn("h-full min-h-[60vh] w-full border-0 sm:min-h-[70vh]", className)}
    />
  );
}

interface AssessmentFileViewerDialogProps extends AssessmentFilePaneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description?: string;
}

export function AssessmentFileViewerDialog({
  open,
  onOpenChange,
  file,
  queryKey,
  loadStreamUrl,
  description,
}: AssessmentFileViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-full flex-col gap-3 rounded-none sm:h-[90vh] sm:max-w-[calc(100%-2rem)] sm:rounded-xl lg:max-w-6xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{file.originalName}</DialogTitle>
          <DialogDescription>
            {description ?? `PDF · ${formatFileSize(file.sizeBytes)} · view only, no download`}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
          {open ? (
            <AssessmentFilePane file={file} queryKey={queryKey} loadStreamUrl={loadStreamUrl} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
