"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, FolderInput, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileUpload } from "@/components/shared/file-upload";
import { FileViewerDialog } from "@/components/shared/file-viewer-dialog";
import { FileTypeIcon, fileKindLabel } from "@/components/shared/file-type-icon";
import { tutorFilesApi } from "@/lib/api/course-files.api";
import { tutorLessonsApi } from "@/lib/api/lessons.api";
import { formatDate, formatFileSize } from "@/lib/utils/format";
import type { CourseFile } from "@/types/course-file";
import { ApiError } from "@/types/api";

// Mirrors the backend default (MAX_FILE_SIZE_BYTES); Multer also enforces it.
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.pptx,.mp4,.m4v,.webm,application/pdf,video/mp4,video/webm";
const NO_LESSON = "none";

interface CourseFilesManagerProps {
  courseId: string;
  /** Deactivated course seen by its tutor: files can be viewed, not uploaded, moved or deleted. */
  readOnly?: boolean;
}

export function CourseFilesManager({ courseId, readOnly = false }: CourseFilesManagerProps) {
  const queryClient = useQueryClient();
  const filesQueryKey = ["tutor", "courses", courseId, "files"];
  const [lessonId, setLessonId] = React.useState<string>(NO_LESSON);
  const [deleteTarget, setDeleteTarget] = React.useState<CourseFile | null>(null);
  const [viewerFile, setViewerFile] = React.useState<CourseFile | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);

  const { data: lessons } = useQuery({
    queryKey: ["tutor", "courses", courseId, "lessons"],
    queryFn: () => tutorLessonsApi.listForCourse(courseId),
  });

  const { data: files, isLoading, isError, refetch } = useQuery({
    queryKey: filesQueryKey,
    queryFn: () => tutorFilesApi.listForCourse(courseId, { pageSize: 100 }),
  });

  const lessonItems = React.useMemo(() => {
    const items: Record<string, string> = { [NO_LESSON]: "Whole course (no specific lesson)" };
    for (const [index, lesson] of (lessons ?? []).entries()) {
      items[lesson.id] = `${index + 1}. ${lesson.title}`;
    }
    return items;
  }, [lessons]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: filesQueryKey });
    void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId, "lessons"] });
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await tutorFilesApi.upload(courseId, file, lessonId === NO_LESSON ? undefined : lessonId, setUploadProgress);
      toast.success(`"${uploaded.originalName}" uploaded`);
      invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The upload failed. Check your connection and try again.");
      throw error;
    } finally {
      setIsUploading(false);
    }
  }

  const setLessonMutation = useMutation({
    mutationFn: (payload: { file: CourseFile; lessonId: string | null }) =>
      tutorFilesApi.setLesson(payload.file.id, payload.lessonId),
    onSuccess: (_, payload) => {
      toast.success(
        payload.lessonId
          ? `"${payload.file.originalName}" attached to ${lessonItems[payload.lessonId] ?? "the lesson"}`
          : `"${payload.file.originalName}" is now a course-wide resource`,
      );
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't move the file. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tutorFilesApi.remove(id),
    onSuccess: () => {
      toast.success(deleteTarget ? `"${deleteTarget.originalName}" deleted` : "File deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete the file. Please try again."),
  });

  return (
    <div className="space-y-6">
      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          The course is deactivated, so material cannot be added, moved or deleted. You can still open every file.
        </p>
      ) : (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UploadCloud className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Add material</p>
              <p className="text-sm text-muted-foreground">
                Students view everything in the browser and cannot download it. Upload a PDF, PowerPoint (.pptx) or MP4 video.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="upload-lesson">Attach to lesson</Label>
            <Select items={lessonItems} value={lessonId} onValueChange={(value) => setLessonId(value ?? NO_LESSON)}>
              <SelectTrigger id="upload-lesson" className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(lessonItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(lessons ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Add a lesson first if you want to attach the file to one. You can also move files later.</p>
            ) : null}
          </div>

          <FileUpload
            onUpload={handleUpload}
            accept={ACCEPTED_TYPES}
            maxSizeBytes={MAX_FILE_SIZE_BYTES}
            isUploading={isUploading}
            progress={uploadProgress}
          />
          <p className="text-xs text-muted-foreground">
            Video tip: an MP4 exported from PowerPoint, Zoom or your phone plays fine. Keep this tab open until the upload finishes.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Files in this course</h3>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : files!.items.length === 0 ? (
          <EmptyState title="No files yet" description="Material you upload appears here, with the lesson it belongs to." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {files!.items.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-4 py-3">
                <FileTypeIcon mimeType={file.mimeType} fileName={file.originalName} className="size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setViewerFile(file)}
                    className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {file.originalName}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{fileKindLabel(file.mimeType, file.originalName)}</span>
                    <span>·</span>
                    <span>{formatFileSize(file.sizeBytes)}</span>
                    <span>·</span>
                    <span>Added {formatDate(file.createdAt)}</span>
                    <Badge variant="outline" className="font-normal">
                      {file.lessonId ? lessonItems[file.lessonId] ?? "Lesson" : "Whole course"}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button size="icon-sm" variant="ghost" onClick={() => setViewerFile(file)} aria-label={`View "${file.originalName}"`}>
                    <Eye className="size-4" />
                  </Button>
                  {!readOnly ? (
                    <>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button size="icon-sm" variant="ghost" aria-label={`Move "${file.originalName}" to a lesson`} disabled={setLessonMutation.isPending} />
                        }
                      >
                        <FolderInput className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Attach to</DropdownMenuLabel>
                        <DropdownMenuItem
                          disabled={file.lessonId === null}
                          onClick={() => setLessonMutation.mutate({ file, lessonId: null })}
                        >
                          Whole course
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {(lessons ?? []).length === 0 ? (
                          <DropdownMenuItem disabled>No lessons yet</DropdownMenuItem>
                        ) : (
                          (lessons ?? []).map((lesson, index) => (
                            <DropdownMenuItem
                              key={lesson.id}
                              disabled={file.lessonId === lesson.id}
                              onClick={() => setLessonMutation.mutate({ file, lessonId: lesson.id })}
                            >
                              {index + 1}. {lesson.title}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(file)} aria-label={`Delete "${file.originalName}"`}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FileViewerDialog file={viewerFile} open={!!viewerFile} onOpenChange={(open) => !open && setViewerFile(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `Delete "${deleteTarget.originalName}"?` : "Delete this file?"}
        description="Students lose access immediately and the file cannot be recovered."
        confirmLabel="Delete file"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
