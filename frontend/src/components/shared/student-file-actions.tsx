"use client";

import { Eye, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canPreviewInBrowser } from "@/lib/utils/file-preview";

/** Anything with a name and a type can be offered for viewing. */
interface ViewableFile {
  mimeType: string;
  originalName: string;
}

interface StudentFileActionsProps<T extends ViewableFile> {
  file: T;
  onView: (file: T) => void;
  /** Overrides the accessible label, e.g. a study material's title. */
  label?: string;
}

/** Students never download: the only action is to open the file in the viewer. */
export function StudentFileActions<T extends ViewableFile>({ file, onView, label }: StudentFileActionsProps<T>) {
  const canView = canPreviewInBrowser(file.mimeType, file.originalName);
  const name = label ?? file.originalName;

  if (!canView) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <FileWarning className="size-3.5" />
        Can&apos;t be opened here
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => onView(file)} aria-label={`Open "${name}"`}>
      <Eye className="size-3.5" />
      Open
    </Button>
  );
}
