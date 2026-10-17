"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, List, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { FilePreviewPane } from "@/components/shared/file-preview-pane";
import { FileTypeIcon, fileKindLabel } from "@/components/shared/file-type-icon";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { studentCoursesApi } from "@/lib/api/courses.api";
import { studentLessonsApi } from "@/lib/api/lessons.api";
import { studentFilesApi } from "@/lib/api/course-files.api";
import { formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { isLessonComplete, type Lesson } from "@/types/lesson";
import { ApiError } from "@/types/api";

const LOCKED_HINT = "Finish the earlier lessons first — this course has to be worked through in order.";

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
    retry: false,
  });

  const lessonsQuery = useQuery({
    queryKey: ["student", "courses", courseId, "lessons"],
    queryFn: () => studentLessonsApi.listForCourse(courseId),
  });

  const filesQuery = useQuery({
    queryKey: ["student", "courses", courseId, "files"],
    queryFn: () => studentFilesApi.listForCourse(courseId, { pageSize: 100 }),
  });

  /** Pulls the rail, the lesson and the course progress back in sync. */
  const refreshProgress = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["student", "lessons", params.lessonId] });
    void queryClient.invalidateQueries({ queryKey: ["student", "courses"] });
    void queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
  }, [queryClient, params.lessonId]);

  const completeMutation = useMutation({
    mutationFn: (payload: { lessonId: string; completed: boolean }) =>
      studentLessonsApi.setCompleted(payload.lessonId, payload.completed),
    onSuccess: () => refreshProgress(),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save your progress. Please try again."),
  });

  if (lessonQuery.isLoading) return <FullPageSpinner />;

  // The server refuses a locked lesson even if the URL is typed by hand.
  if (lessonQuery.error instanceof ApiError && lessonQuery.error.status === 403) {
    return (
      <div className="space-y-6">
        <PageBreadcrumb
          items={[
            { label: "My courses", href: "/student/courses" },
            { label: courseQuery.data?.title ?? "Course", href: `/student/courses/${courseId}` },
            { label: "Locked lesson" },
          ]}
        />
        <EmptyState
          icon={Lock}
          title="This lesson is locked"
          description={LOCKED_HINT}
          action={
            <Button nativeButton={false} render={<Link href={`/student/courses/${courseId}`} />}>
              <ArrowLeft className="size-4" />
              Back to the course
            </Button>
          }
        />
      </div>
    );
  }

  if (lessonQuery.isError || !lessonQuery.data) {
    return <ErrorState onRetry={() => void lessonQuery.refetch()} />;
  }

  const lesson = lessonQuery.data;
  const course = courseQuery.data;
  const courseLessons = lessonsQuery.data ?? [];
  const isCompleted = isLessonComplete(lesson);
  const isSequential = course?.progressionMode === "SEQUENTIAL";
  const lessonFiles = lesson.files ?? (filesQuery.data?.items ?? []).filter((file) => file.lessonId === lesson.id);
  const viewedCount = lessonFiles.filter((file) => file.isViewed).length;
  const selectedFile = lessonFiles.find((file) => file.id === selectedFileId) ?? lessonFiles[0] ?? null;
  const currentIndex = courseLessons.findIndex((item) => item.id === lesson.id);
  const previous = currentIndex > 0 ? courseLessons[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : null;
  const hasContent = lesson.content.trim().length > 0;
  // In a free course the student may always move on. In a sequential one the
  // next lesson stays shut until this one is finished.
  const nextLocked = !!next && (next.isLocked === true || (isSequential && !isCompleted));

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

  /** A file was read/watched to the end; the server says whether that finished the lesson. */
  function handleFileViewed(result: { lessonCompleted: boolean }) {
    refreshProgress();
    if (result.lessonCompleted) {
      toast.success(next ? "Lesson complete. On to the next one!" : "Lesson complete. That was the last one!");
    }
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
            ) : lessonFiles.length > 0 ? (
              <div className="max-w-sm pt-1">
                <Progress
                  value={lessonFiles.length === 0 ? 0 : Math.round((viewedCount / lessonFiles.length) * 100)}
                  className="gap-1.5"
                >
                  <span className="text-xs text-muted-foreground">
                    {viewedCount} of {lessonFiles.length} opened
                  </span>
                </Progress>
              </div>
            ) : null}
          </header>

          {filesQuery.isLoading && lessonFiles.length === 0 ? (
            <Skeleton className="aspect-video w-full rounded-xl" />
          ) : filesQuery.isError && lessonFiles.length === 0 ? (
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
                      {file.isViewed ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <FileTypeIcon mimeType={file.mimeType} fileName={file.originalName} className="size-3.5" />
                      )}
                      <span className="truncate">{file.originalName}</span>
                    </Button>
                  ))}
                </div>
              ) : null}
              <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                <FilePreviewPane key={selectedFile.id} file={selectedFile} trackViewing onViewed={handleFileViewed} />
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
                          {file.isViewed ? " · finished" : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
                        {file.isViewed ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : null}
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
                  : lessonFiles.length > 0
                    ? `Work through every file to the end and this lesson completes itself (${viewedCount} of ${lessonFiles.length} done).`
                    : "Finished reading? Mark it done to track your progress."}
              </p>
              {isCompleted ? (
                lessonFiles.length === 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate({ lessonId: lesson.id, completed: false })}
                  >
                    <RotateCcw className="size-3.5" />
                    Mark as not done
                  </Button>
                ) : null
              ) : lessonFiles.length === 0 ? (
                next ? (
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
                )
              ) : null}
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
                nextLocked ? (
                  <Tooltip>
                    {/* The trigger is the wrapper, not the button: a disabled
                        button emits no pointer events, so the tooltip would
                        never open. */}
                    <TooltipTrigger render={<span className="inline-flex" />}>
                      <Button variant="outline" disabled>
                        <Lock className="size-4" />
                        <span className="truncate">Next: {next.title}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Finish this lesson to unlock the next one.</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant={isCompleted ? "default" : "outline"}
                    nativeButton={false}
                    render={<Link href={`/student/courses/${courseId}/lessons/${next.id}`} />}
                  >
                    <span className="truncate">Next: {next.title}</span>
                    <ArrowRight className="size-4" />
                  </Button>
                )
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
  const doneCount = lessons.filter(isLessonComplete).length;
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
            const isDone = isLessonComplete(item);
            const isLocked = item.isLocked === true && !isCurrent;

            const label = (
              <>
                {isLocked ? (
                  <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
                ) : isDone ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Circle className={cn("mt-0.5 size-4 shrink-0", isCurrent ? "text-primary" : "text-muted-foreground/60")} />
                )}
                <span className="min-w-0">
                  <span className="block leading-snug">
                    {index + 1}. {item.title}
                  </span>
                </span>
              </>
            );

            return (
              <li key={item.id}>
                {isLocked ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div
                          aria-disabled="true"
                          className="flex cursor-not-allowed items-start gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground/80"
                        />
                      }
                    >
                      {label}
                    </TooltipTrigger>
                    <TooltipContent>{LOCKED_HINT}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    href={`/student/courses/${courseId}/lessons/${item.id}`}
                    onClick={onNavigate}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted",
                      isCurrent ? "bg-primary/10 font-medium text-primary" : "text-foreground",
                    )}
                  >
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
