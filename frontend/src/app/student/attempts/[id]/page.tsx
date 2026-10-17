"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { AttemptResultView } from "@/components/assessments/attempt-result-view";
import { studentAssessmentsApi } from "@/lib/api/assessments.api";

export default function StudentAttemptResultPage() {
  const params = useParams<{ id: string }>();

  const { data: attempt, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "attempts", params.id],
    queryFn: () => studentAssessmentsApi.getAttempt(params.id),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !attempt) {
    return (
      <ErrorState
        title="Couldn't load this result"
        description="The attempt may no longer exist. Open the course again and try from there."
        onRetry={() => void refetch()}
      />
    );
  }

  // Unlimited retries, except once passed.
  const canRetry = attempt.status === "FAILED";

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "My courses", href: "/student/courses" },
          { label: attempt.courseTitle, href: `/student/courses/${attempt.courseId}` },
          { label: `${attempt.assessmentTitle} · attempt ${attempt.attemptNumber}` },
        ]}
      />

      <AttemptResultView attempt={attempt} viewer="student" />

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/student/courses/${attempt.courseId}`} />}
        >
          <ArrowLeft className="size-4" />
          Back to course
        </Button>
        {canRetry ? (
          <Button nativeButton={false} render={<Link href={`/student/assessments/${attempt.assessmentId}`} />}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
