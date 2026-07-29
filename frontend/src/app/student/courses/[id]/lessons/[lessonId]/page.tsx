"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { ErrorState } from "@/components/shared/error-state";
import { studentLessonsApi } from "@/lib/api/lessons.api";

export default function StudentLessonViewerPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();

  const { data: lesson, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "lessons", params.lessonId],
    queryFn: () => studentLessonsApi.getById(params.lessonId),
  });

  if (isLoading) return <FullPageSpinner />;
  if (isError || !lesson) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push(`/student/courses/${params.id}`)}>
        <ArrowLeft className="size-4" />
        Back to course
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lesson.title}</h1>
        <p className="text-sm text-muted-foreground">{lesson.filesCount} attached file(s)</p>
      </div>

      <Card>
        <CardContent>
          <div className="max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {lesson.content}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
