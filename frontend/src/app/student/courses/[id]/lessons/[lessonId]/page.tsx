"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  FileWarning,
  List,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { ErrorState } from "@/components/shared/error-state";
import { FilePreviewPane } from "@/components/shared/file-preview-pane";
import { studentLessonsApi } from "@/lib/api/lessons.api";
import { studentFilesApi } from "@/lib/api/course-files.api";
import { cn } from "@/lib/utils";

export default function StudentLessonViewerPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null);
  const [lessonsOpen, setLessonsOpen] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(false);

  const lessonQuery = useQuery({
    queryKey: ["student", "lessons", params.lessonId],
    queryFn: () => studentLessonsApi.getById(params.lessonId),
  });

  const lessonsQuery = useQuery({
    queryKey: ["student", "courses", params.id, "lessons"],
    queryFn: () => studentLessonsApi.listForCourse(params.id),
  });

  const filesQuery = useQuery({
    queryKey: ["student", "courses", params.id, "files"],
    queryFn: () => studentFilesApi.listForCourse(params.id, { pageSize: 100 }),
  });

  if (lessonQuery.isLoading) return <FullPageSpinner />;
  if (lessonQuery.isError || !lessonQuery.data) {
    return <ErrorState onRetry={() => void lessonQuery.refetch()} />;
  }

  const lesson = lessonQuery.data;
  const courseLessons = lessonsQuery.data ?? [];
  const lessonFiles = (filesQuery.data?.items ?? []).filter((file) => file.lessonId === lesson.id);
  const selectedFile = lessonFiles.find((file) => file.id === selectedFileId) ?? lessonFiles[0] ?? null;
  const currentIndex = courseLessons.findIndex((item) => item.id === lesson.id);

  return (
    <div className="-mx-4 flex min-h-[calc(100vh-7rem)] flex-col gap-4 sm:-mx-6 lg:-mx-8">
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => router.push(`/student/courses/${params.id}`)}
        >
          <ArrowLeft className="size-4" />
          Back to course
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {lesson.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lesson.filesCount} attached file{lesson.filesCount === 1 ? "" : "s"}
            {currentIndex >= 0 ? ` · Lesson ${currentIndex + 1} of ${courseLessons.length}` : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden lg:inline-flex"
            onClick={() => setLessonsOpen((open) => !open)}
            aria-pressed={lessonsOpen}
          >
            {lessonsOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
            {lessonsOpen ? "Hide lessons" : "Show lessons"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setLessonsOpen((open) => !open)}
            aria-pressed={lessonsOpen}
          >
            <List className="size-4" />
            Lessons
          </Button>

          {lesson.content ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNotesOpen((open) => !open)}
              aria-expanded={notesOpen}
            >
              {notesOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              Notes
            </Button>
          ) : null}
        </div>
      </div>

      {notesOpen && lesson.content ? (
        <Card className="mx-4 sm:mx-6 lg:mx-8">
          <CardContent className="pt-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{lesson.content}</div>
          </CardContent>
        </Card>
      ) : null}

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-4 px-4 sm:px-6 lg:px-8",
          lessonsOpen ? "lg:grid-cols-[220px_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        <aside
          className={cn(
            "min-h-0",
            lessonsOpen ? "block" : "hidden",
            "lg:sticky lg:top-20 lg:self-start",
          )}
        >
          <Card className="max-h-[calc(100vh-9rem)] overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpen className="size-4" />
                Course lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-12rem)] space-y-1 overflow-y-auto pb-3">
              {lessonsQuery.isError ? (
                <p className="text-sm text-destructive">Unable to load the lesson list.</p>
              ) : courseLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lessons available.</p>
              ) : (
                courseLessons.map((item, index) => (
                  <Link
                    key={item.id}
                    href={`/student/courses/${params.id}/lessons/${item.id}`}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
                      item.id === lesson.id && "bg-primary/10 font-medium text-primary",
                    )}
                  >
                    <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
                    <span>{item.title}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <Card className="flex min-h-[calc(100vh-10rem)] flex-1 flex-col overflow-hidden">
            <CardHeader className="shrink-0 space-y-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  Lesson material
                </CardTitle>
                {selectedFile ? (
                  <p className="truncate text-sm text-muted-foreground">{selectedFile.originalName}</p>
                ) : null}
              </div>
              {lessonFiles.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {lessonFiles.map((file) => (
                    <Button
                      key={file.id}
                      size="sm"
                      variant={selectedFile?.id === file.id ? "default" : "outline"}
                      onClick={() => setSelectedFileId(file.id)}
                    >
                      {file.originalName}
                    </Button>
                  ))}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              {filesQuery.isLoading ? (
                <div className="flex min-h-96 flex-1 items-center justify-center text-sm text-muted-foreground">
                  Loading lesson material…
                </div>
              ) : filesQuery.isError ? (
                <ErrorState onRetry={() => void filesQuery.refetch()} />
              ) : selectedFile ? (
                <div className="min-h-0 flex-1 border-t border-border bg-muted/20">
                  <FilePreviewPane key={selectedFile.id} file={selectedFile} />
                </div>
              ) : (
                <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <FileWarning className="size-10 text-amber-500" />
                  <p className="text-sm text-muted-foreground">No file is attached to this lesson.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
