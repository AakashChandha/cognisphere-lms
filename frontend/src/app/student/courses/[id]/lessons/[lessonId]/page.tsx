"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, List, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { ErrorState } from "@/components/shared/error-state";
import { FilePreviewPane } from "@/components/shared/file-preview-pane";
import { FileTypeIcon, fileKindLabel } from "@/components/shared/file-type-icon";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { studentCoursesApi } from "@/lib/api/courses.api";
import { studentLessonsApi } from "@/lib/api/lessons.api";
import { studentFilesApi } from "@/lib/api/course-files.api";
import { formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/types/lesson";
import { ApiError } from "@/types/api";

export default function StudentLessonViewerPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const courseId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  // Keyed by lesson so navigating to another lesson resets the chosen file
  // without an effect.
  const [selection, setSelection] = React.useState<{ lessonId: string; fileId: string } | null>(null);
  const selectedFileId = selection?.lessonId === params.lessonId ? selection.fileId : null;
  const setSelectedFileId = React.useCallback(
    (fileId: string) => setSelection({ lessonId: params.lessonId, fileId }),
    [params.lessonId],
  );
  const [lessonsSheetOpen, setLessonsSheetOpen] = React.useState(false);
  const mediaRef = React.useRef<HTMLDivElement>(null);

  const courseQuery = useQuery({
    queryKey: ["student", "courses", courseId],
    queryFn: () => studentCoursesApi.getById(courseId),
  });

  const lessonQuery = useQuery({
    queryKey: ["student", "lessons", params.lessonId],
    queryFn: () => studentLessonsApi.getById(params.lessonId),
  });

  const lessonsQuery = useQuery({
    queryKey: ["student", "courses", courseId, "lessons"],
    queryFn: () => studentLessonsApi.listForCourse(courseId),
  });

  const filesQuery = useQuery({
    queryKey: ["student", "courses", courseId, "files"],
    queryFn: () => studentFilesApi.listForCourse(courseId, { pageSize: 100 }),
  });

  const completeMutation = useMutation({
    mutationFn: (payload: { lessonId: string; completed: boolean }) =>
      studentLessonsApi.setCompleted(payload.lessonId, payload.completed),
    onSuccess: (_, payload) => {
      void queryClient.invalidateQueries({ queryKey: ["student", "lessons", payload.lessonId] });
      void queryClient.invalidateQueries({ queryKey: ["student", "courses"] });
      void queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save your progress. Please try again."),
  });

  if (lessonQuery.isLoading) return <FullPageSpinner />;
  if (lessonQuery.isError || !lessonQuery.data) {
    return <ErrorState onRetry={() => void lessonQuery.refetch()} />;
  }

  const lesson = lessonQuery.data;
  const course = courseQuery.data;
  const courseLessons = lessonsQuery.data ?? [];
  const isCompleted = !!lesson.completed;
  const lessonFiles = (filesQuery.data?.items ?? []).filter((file) => file.lessonId === lesson.id);
  const selectedFile = lessonFiles.find((file) => file.id === selectedFileId) ?? lessonFiles[0] ?? null;
  const currentIndex = courseLessons.findIndex((item) => item.id === lesson.id);
  const previous = currentIndex > 0 ? courseLessons[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : null;
  const hasContent = lesson.content.trim().length > 0;

  function openFile(fileId: string) {
    setSelectedFileId(fileId);
    mediaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Idempotent, so a video "ended" event can fire freely without toast spam. */
  function markComplete() {
    if (isCompleted || completeMutation.isPending) return;
    completeMutation.mutate(
      { lessonId: lesson.id, completed: true },
      {
        onSuccess: () =>
          toast.success(next ? "Lesson complete. On to the next one!" : "Lesson complete. That was the last one!"),
      },
    );
  }

  const lessonList = (
    <LessonRail
      lessons={courseLessons}
      currentId={lesson.id}
      courseId={courseId}
      courseTitle={course?.title}
      isError={lessonsQuery.isError}
      onNavigate={() => setLessonsSheetOpen(false)}
    />
  );

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        items={[
          { label: "My courses", href: "/student/courses" },
          { label: course?.title ?? "Course", href: `/student/courses/${courseId}` },
          { label: currentIndex >= 0 ? `Lesson ${currentIndex + 1}` : lesson.title },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-card p-3">
            {lessonList}
          </div>
        </aside>

        <article className="min-w-0 max-w-3xl space-y-8">
          <header className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-primary">
                {currentIndex >= 0 ? `Lesson ${currentIndex + 1} of ${courseLessons.length}` : "Lesson"}
              </p>
              <Sheet open={lessonsSheetOpen} onOpenChange={setLessonsSheetOpen}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setLessonsSheetOpen(true)}
                >
                  <List className="size-4" />
                  All lessons
                </Button>
                <SheetContent side="left" className="w-80 overflow-y-auto p-4">
                  <SheetTitle className="sr-only">Course lessons</SheetTitle>
                  {lessonList}
                </SheetContent>
              </Sheet>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{lesson.title}</h1>
            {isCompleted ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" /> You have completed this lesson
              </p>
            ) : null}
          </header>

          {filesQuery.isLoading ? (
            <Skeleton className="aspect-video w-full rounded-xl" />
          ) : filesQuery.isError ? (
            <ErrorState onRetry={() => void filesQuery.refetch()} />
          ) : selectedFile ? (
            <section ref={mediaRef} className="scroll-mt-20 space-y-3">
              {lessonFiles.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {lessonFiles.map((file) => (
                    <Button
                      key={file.id}
                      size="sm"
                      variant={selectedFile.id === file.id ? "default" : "outline"}
                      onClick={() => setSelectedFileId(file.id)}
                      className="max-w-full"
                    >
                      <FileTypeIcon mimeType={file.mimeType} fileName={file.originalName} className="size-3.5" />
                      <span className="truncate">{file.originalName}</span>
                    </Button>
                  ))}
                </div>
              ) : null}
              <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                <FilePreviewPane key={selectedFile.id} file={selectedFile} onVideoEnded={markComplete} />
              </div>
            </section>
          ) : null}

          {hasContent ? (
            <section>
              <MarkdownContent content={lesson.content} className="prose-lg" />
            </section>
          ) : !selectedFile && !filesQuery.isLoading ? (
            <section className="rounded-xl border border-dashed border-border p-8 text-center">
              <BookOpen className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Your tutor has not added material to this lesson yet. Check back soon.
              </p>
            </section>
          ) : null}

          {lessonFiles.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Materials for this lesson</h2>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {lessonFiles.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => openFile(file.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                        selectedFile?.id === file.id && "bg-primary/5",
                      )}
                    >
                      <FileTypeIcon mimeType={file.mimeType} fileName={file.originalName} className="size-5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{file.originalName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {fileKindLabel(file.mimeType, file.originalName)} · {formatFileSize(file.sizeBytes)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-primary">
                        {selectedFile?.id === file.id ? "Showing" : "Open"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <footer className="space-y-4 border-t border-border pt-6">
            <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {isCompleted
                  ? "Marked as complete."
                  : "Finished reading and watching? Mark it done to track your progress."}
              </p>
              {isCompleted ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={completeMutation.isPending}
                  onClick={() => completeMutation.mutate({ lessonId: lesson.id, completed: false })}
                >
                  <RotateCcw className="size-3.5" />
                  Mark as not done
                </Button>
              ) : next ? (
                <Button
                  disabled={completeMutation.isPending}
                  onClick={() =>
                    completeMutation.mutate(
                      { lessonId: lesson.id, completed: true },
                      { onSuccess: () => router.push(`/student/courses/${courseId}/lessons/${next.id}`) },
                    )
                  }
                >
                  <CheckCircle2 className="size-4" />
                  Mark complete and continue
                </Button>
              ) : (
                <Button disabled={completeMutation.isPending} onClick={markComplete}>
                  <CheckCircle2 className="size-4" />
                  Mark complete
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {previous ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/student/courses/${courseId}/lessons/${previous.id}`} />}
                >
                  <ArrowLeft className="size-4" />
                  <span className="truncate">Previous: {previous.title}</span>
                </Button>
              ) : (
                <Button variant="outline" nativeButton={false} render={<Link href={`/student/courses/${courseId}`} />}>
                  <ArrowLeft className="size-4" />
                  Back to course
                </Button>
              )}
              {next ? (
                <Button
                  variant={isCompleted ? "default" : "outline"}
                  nativeButton={false}
                  render={<Link href={`/student/courses/${courseId}/lessons/${next.id}`} />}
                >
                  <span className="truncate">Next: {next.title}</span>
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button variant="outline" nativeButton={false} render={<Link href={`/student/courses/${courseId}`} />}>
                  Back to course overview
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}

function LessonRail({
  lessons,
  currentId,
  courseId,
  courseTitle,
  isError,
  onNavigate,
}: {
  lessons: Lesson[];
  currentId: string;
  courseId: string;
  courseTitle?: string;
  isError: boolean;
  onNavigate: () => void;
}) {
  const doneCount = lessons.filter((l) => l.completed).length;
  return (
    <nav aria-label="Course lessons" className="space-y-3">
      <div className="px-2">
        <Link href={`/student/courses/${courseId}`} className="text-sm font-semibold text-foreground hover:underline">
          {courseTitle ?? "Course"}
        </Link>
        <p className="text-xs text-muted-foreground">
          {lessons.length === 0 ? "No lessons yet" : `${doneCount} of ${lessons.length} complete`}
        </p>
      </div>
      {isError ? (
        <p className="px-2 text-sm text-destructive">Unable to load the lesson list.</p>
      ) : (
        <ol className="space-y-0.5">
          {lessons.map((item, index) => {
            const isCurrent = item.id === currentId;
            const isDone = !!item.completed;
            return (
              <li key={item.id}>
                <Link
                  href={`/student/courses/${courseId}/lessons/${item.id}`}
                  onClick={onNavigate}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted",
                    isCurrent ? "bg-primary/10 font-medium text-primary" : "text-foreground",
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className={cn("mt-0.5 size-4 shrink-0", isCurrent ? "text-primary" : "text-muted-foreground/60")} />
                  )}
                  <span className="min-w-0">
                    <span className="block leading-snug">{index + 1}. {item.title}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
