"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, FileText, Play } from "lucide-react";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { FileViewerDialog } from "@/components/shared/file-viewer-dialog";
import { FileTypeIcon, fileKindLabel } from "@/components/shared/file-type-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { studentCoursesApi } from "@/lib/api/courses.api";
import { studentLessonsApi } from "@/lib/api/lessons.api";
import { studentFilesApi } from "@/lib/api/course-files.api";
import { formatFileSize, pluralize } from "@/lib/utils/format";
import type { CourseFile } from "@/types/course-file";

export default function StudentCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const [viewerFile, setViewerFile] = React.useState<CourseFile | null>(null);

  const courseQuery = useQuery({
    queryKey: ["student", "courses", courseId],
    queryFn: () => studentCoursesApi.getById(courseId),
  });

  const lessonsQuery = useQuery({
    queryKey: ["student", "courses", courseId, "lessons"],
    queryFn: () => studentLessonsApi.listForCourse(courseId),
    enabled: !!courseQuery.data,
  });

  const filesQuery = useQuery({
    queryKey: ["student", "courses", courseId, "files"],
    queryFn: () => studentFilesApi.listForCourse(courseId, { pageSize: 100 }),
    enabled: !!courseQuery.data,
  });

  if (courseQuery.isLoading) return <FullPageSpinner />;
  if (courseQuery.isError || !courseQuery.data) {
    return <ErrorState onRetry={() => void courseQuery.refetch()} />;
  }

  const course = courseQuery.data;
  const lessons = lessonsQuery.data ?? [];
  const files = filesQuery.data?.items ?? [];
  const courseResources = files.filter((file) => file.lessonId === null);
  const filesByLesson = new Map<string, CourseFile[]>();
  for (const file of files) {
    if (file.lessonId) {
      filesByLesson.set(file.lessonId, [...(filesByLesson.get(file.lessonId) ?? []), file]);
    }
  }
  const progress = course.progress;
  const nextLesson = progress?.nextLessonId ? (lessons.find((l) => l.id === progress.nextLessonId) ?? null) : null;
  const targetLesson = nextLesson ?? lessons[0] ?? null;
  const pct =
    progress && progress.totalLessons > 0 ? Math.round((progress.completedLessons / progress.totalLessons) * 100) : 0;
  const allDone = !!progress && progress.totalLessons > 0 && progress.completedLessons === progress.totalLessons;
  const started = !!progress && progress.completedLessons > 0;

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: "My courses", href: "/student/courses" }, { label: course.title }]} />

      <header className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">
            {course.tutor ? `Taught by ${course.tutor.firstName} ${course.tutor.lastName}` : "Course material"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{course.title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{course.description}</p>
          {progress && progress.totalLessons > 0 ? (
            <div className="max-w-md pt-1">
              <Progress value={pct} className="gap-2">
                <span className="text-xs text-muted-foreground">
                  {progress.completedLessons} of {pluralize(progress.totalLessons, "lesson")} complete · {pct}%
                </span>
              </Progress>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {pluralize(course.lessonsCount, "lesson")} · {pluralize(course.filesCount, "file")}
            </p>
          )}
        </div>
        {targetLesson ? (
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={`/student/courses/${courseId}/lessons/${targetLesson.id}`} />}
            className="w-full lg:w-auto"
          >
            {allDone ? <CheckCircle2 className="size-4" /> : <Play className="size-4" />}
            {allDone ? "Review from the start" : started ? `Continue: ${targetLesson.title}` : "Start learning"}
          </Button>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Lessons</h2>
        {lessonsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : lessonsQuery.isError ? (
          <ErrorState onRetry={() => void lessonsQuery.refetch()} />
        ) : lessons.length === 0 ? (
          <EmptyState icon={BookOpen} title="No lessons yet" description="Your tutor is still preparing this course. Check back soon." />
        ) : (
          <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {lessons.map((lesson, index) => {
              const lessonFiles = filesByLesson.get(lesson.id) ?? [];
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/student/courses/${courseId}/lessons/${lesson.id}`}
                    className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/60 sm:px-5"
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        lesson.completed
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-primary/10 text-primary",
                      )}
                      aria-label={lesson.completed ? "Completed" : undefined}
                    >
                      {lesson.completed ? <CheckCircle2 className="size-5" /> : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground sm:text-base">{lesson.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {lessonFiles.length === 0 ? (
                          <span>Reading</span>
                        ) : (
                          lessonFiles.map((file) => (
                            <span key={file.id} className="inline-flex items-center gap-1">
                              <FileTypeIcon mimeType={file.mimeType} fileName={file.originalName} className="size-3.5" />
                              {fileKindLabel(file.mimeType, file.originalName)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-xs font-medium text-muted-foreground sm:block">
                      {lesson.completed ? "Done" : nextLesson?.id === lesson.id ? "Up next" : ""}
                    </span>
                    <Play className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {courseResources.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Course resources</h2>
            <p className="text-sm text-muted-foreground">Material that applies to the whole course.</p>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {courseResources.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => setViewerFile(file)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 sm:px-5"
                >
                  <FileTypeIcon mimeType={file.mimeType} fileName={file.originalName} className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{file.originalName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fileKindLabel(file.mimeType, file.originalName)} · {formatFileSize(file.sizeBytes)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary">Open</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : filesQuery.isLoading ? null : files.length === 0 && lessons.length > 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" /> No files have been added to this course yet.
        </p>
      ) : null}

      <FileViewerDialog file={viewerFile} open={!!viewerFile} onOpenChange={(open) => !open && setViewerFile(null)} />
    </div>
  );
}
