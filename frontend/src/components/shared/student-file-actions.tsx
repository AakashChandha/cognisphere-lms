"use client";

import { Eye, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canPreviewInBrowser } from "@/lib/utils/file-preview";
import type { CourseFile } from "@/types/course-file";

interface StudentFileActionsProps {
  file: CourseFile;
  onView: (file: CourseFile) => void;
}

export function StudentFileActions({ file, onView }: StudentFileActionsProps) {
  const canView = canPreviewInBrowser(file.mimeType, file.originalName);

  if (!canView) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <FileWarning className="size-3.5" />
        Can&apos;t be opened here
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => onView(file)} aria-label={`Open "${file.originalName}"`}>
      <Eye className="size-3.5" />
      Open
    </Button>
  );
}
