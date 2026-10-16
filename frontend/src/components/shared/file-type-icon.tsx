import { FileText, FileVideo, Presentation, File as FileIcon, type LucideProps } from "lucide-react";
import { getFilePreviewKind } from "@/lib/utils/file-preview";
import { cn } from "@/lib/utils";

interface FileTypeIconProps extends LucideProps {
  mimeType: string;
  fileName: string;
}

/** Icon + colour per material type so a video, deck and PDF read differently at a glance. */
export function FileTypeIcon({ mimeType, fileName, className, ...props }: FileTypeIconProps) {
  const kind = getFilePreviewKind(mimeType, fileName);
  if (kind === "video") {
    return <FileVideo className={cn("text-violet-600 dark:text-violet-400", className)} {...props} />;
  }
  if (kind === "pptx") {
    return <Presentation className={cn("text-orange-600 dark:text-orange-400", className)} {...props} />;
  }
  if (kind === "pdf") {
    return <FileText className={cn("text-red-600 dark:text-red-400", className)} {...props} />;
  }
  return <FileIcon className={cn("text-muted-foreground", className)} {...props} />;
}

export function fileKindLabel(mimeType: string, fileName: string): string {
  const kind = getFilePreviewKind(mimeType, fileName);
  if (kind === "video") return "Video";
  if (kind === "pptx") return "Slides";
  if (kind === "pdf") return "PDF";
  return "File";
}
