"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2, Download as DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileUpload } from "@/components/shared/file-upload";
import { tutorFilesApi, downloadFile } from "@/lib/api/course-files.api";
import { tutorLessonsApi } from "@/lib/api/lessons.api";
import { formatDate, formatFileSize } from "@/lib/utils/format";
import type { CourseFile } from "@/types/course-file";
import { ApiError } from "@/types/api";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function CourseFilesManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const filesQueryKey = ["tutor", "courses", courseId, "files"];
  const [lessonId, setLessonId] = React.useState<string>("none");
  const [deleteTarget, setDeleteTarget] = React.useState<CourseFile | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);

  const { data: lessons } = useQuery({
    queryKey: ["tutor", "courses", courseId, "lessons"],
    queryFn: () => tutorLessonsApi.listForCourse(courseId),
  });

  const { data: files, isLoading, isError, refetch } = useQuery({
    queryKey: filesQueryKey,
    queryFn: () => tutorFilesApi.listForCourse(courseId, { pageSize: 50 }),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: filesQueryKey });
    void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId, "lessons"] });
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      await tutorFilesApi.upload(courseId, file, lessonId === "none" ? undefined : lessonId, setUploadProgress);
      toast.success("File uploaded successfully");
      invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to upload file");
      throw error;
    } finally {
      setIsUploading(false);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tutorFilesApi.remove(id),
    onSuccess: () => {
      toast.success("File deleted successfully");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete file"),
  });

  async function handleDownload(file: CourseFile) {
    try {
      await downloadFile(file.downloadUrl, file.originalName);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to download file");
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">Upload a new file</p>
          {lessons && lessons.length > 0 ? (
            <Select value={lessonId} onValueChange={(value) => setLessonId(value ?? "none")}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Attach to a lesson (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific lesson</SelectItem>
                {lessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <FileUpload
          onUpload={handleUpload}
          maxSizeBytes={MAX_FILE_SIZE_BYTES}
          isUploading={isUploading}
          progress={uploadProgress}
        />
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : files!.items.length === 0 ? (
        <EmptyState icon={FileText} title="No files uploaded yet" />
      ) : (
        <div className="space-y-2">
          {files!.items.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{file.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.sizeBytes)} · Uploaded {formatDate(file.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => void handleDownload(file)} aria-label="Download">
                  <DownloadIcon className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(file)}
                  aria-label="Delete file"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this file?"
        description="Students will no longer be able to access this file. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
