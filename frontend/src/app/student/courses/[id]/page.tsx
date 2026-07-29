"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, FileText, Layers, Users, Download as DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseStatusBadge } from "@/components/shared/status-badge";
import { studentCoursesApi } from "@/lib/api/courses.api";
import { studentLessonsApi } from "@/lib/api/lessons.api";
import { studentFilesApi, downloadFile } from "@/lib/api/course-files.api";
import { formatFileSize } from "@/lib/utils/format";
import { toast } from "sonner";
import { ApiError } from "@/types/api";

export default function StudentCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params.id;

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
    queryFn: () => studentFilesApi.listForCourse(courseId, { pageSize: 50 }),
    enabled: !!courseQuery.data,
  });

  async function handleDownload(url: string, filename: string) {
    try {
      await downloadFile(url, filename);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to download file");
    }
  }

  if (courseQuery.isLoading) return <FullPageSpinner />;
  if (courseQuery.isError) {
    return <ErrorState onRetry={() => void courseQuery.refetch()} />;
  }

  const course = courseQuery.data!;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/student/courses")}>
        <ArrowLeft className="size-4" />
        Back to courses
      </Button>

      <PageHeader
        title={course.title}
        description={`Taught by ${course.tutor.firstName} ${course.tutor.lastName}`}
        actions={<CourseStatusBadge status={course.status} />}
      />

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <p className="text-sm text-muted-foreground sm:col-span-3">{course.description}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Layers className="size-4" /> {course.lessonsCount} lessons
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4" /> {course.filesCount} files
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" /> {course.enrollmentsCount} students
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="lessons">
        <TabsList>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="files">Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="mt-4 space-y-3">
          {lessonsQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : lessonsQuery.isError ? (
            <ErrorState onRetry={() => void lessonsQuery.refetch()} />
          ) : lessonsQuery.data!.length === 0 ? (
            <EmptyState icon={BookOpen} title="No lessons yet" description="Check back later for course content." />
          ) : (
            lessonsQuery.data!.map((lesson, index) => (
              <Link
                key={lesson.id}
                href={`/student/courses/${courseId}/lessons/${lesson.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                    <p className="text-xs text-muted-foreground">{lesson.filesCount} attached file(s)</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="files" className="mt-4 space-y-3">
          {filesQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : filesQuery.isError ? (
            <ErrorState onRetry={() => void filesQuery.refetch()} />
          ) : filesQuery.data!.items.length === 0 ? (
            <EmptyState icon={FileText} title="No materials uploaded yet" />
          ) : (
            filesQuery.data!.items.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.originalName}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDownload(file.downloadUrl, file.originalName)}
                >
                  <DownloadIcon className="size-3.5" />
                  Download
                </Button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
