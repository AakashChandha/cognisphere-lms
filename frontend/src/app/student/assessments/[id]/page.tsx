"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorState } from "@/components/shared/error-state";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { McqAttemptForm } from "@/components/assessments/mcq-attempt-form";
import { DocumentAttemptPanel } from "@/components/assessments/document-attempt-panel";
import {
  AssessmentTypeBadge,
  AttemptStatusBadge,
} from "@/components/assessments/assessment-badges";
import { studentAssessmentsApi } from "@/lib/api/assessments.api";
import { pluralize } from "@/lib/utils/format";
import { ApiError } from "@/types/api";
import type { AttemptDetail } from "@/types/assessment";

export default function StudentTakeAssessmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = React.useState<AttemptDetail | null>(null);

  const { data: assessment, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["student", "assessments", params.id],
    queryFn: () => studentAssessmentsApi.getById(params.id),
  });

  const startMutation = useMutation({
    // The API returns the open attempt instead of creating a second one.
    mutationFn: () => studentAssessmentsApi.startAttempt(params.id),
    onSuccess: (started) => setAttempt(started),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Couldn't start the assessment. Please try again."),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["student", "assessments", params.id] });
    void queryClient.invalidateQueries({ queryKey: ["student", "courses"] });
    void queryClient.invalidateQueries({ queryKey: ["student", "attempts"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !assessment) {
    return (
      <ErrorState
        title="Couldn't open this assessment"
        description={
          error instanceof ApiError && error.status === 404
            ? "This assessment is not available. It may have been unpublished, or you may not be enrolled in the course."
            : "Something went wrong loading the assessment. Please try again."
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const breadcrumb = (
    <PageBreadcrumb
      items={[
        { label: "My courses", href: "/student/courses" },
        { label: assessment.courseTitle, href: `/student/courses/${assessment.courseId}` },
        { label: assessment.title },
      ]}
    />
  );

  const header = (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <AssessmentTypeBadge type={assessment.type} />
        <AttemptStatusBadge status={assessment.myStatus} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{assessment.title}</h1>
      <p className="text-sm text-muted-foreground">
        Pass {assessment.passPercent}%
        {assessment.type === "MCQ" ? ` · ${pluralize(assessment.questionCount, "question")}` : ""}
        {assessment.timeLimitMinutes ? ` · ${assessment.timeLimitMinutes} minute limit` : " · No time limit"}
        {assessment.attemptsCount > 0 ? ` · ${pluralize(assessment.attemptsCount, "attempt")} so far` : ""}
      </p>
    </header>
  );

  // A pass is final: no retake, just the result.
  if (assessment.myStatus === "PASSED") {
    return (
      <div className="space-y-6">
        {breadcrumb}
        {header}
        <Alert>
          <Trophy className="size-4" />
          <AlertTitle>You have already passed this assessment</AlertTitle>
          <AlertDescription>
            Your best score is {assessment.bestScorePercent ?? assessment.passPercent}%. Passed assessments cannot be
            retaken.
          </AlertDescription>
        </Alert>
        {assessment.latestAttemptId ? (
          <Button nativeButton={false} render={<Link href={`/student/attempts/${assessment.latestAttemptId}`} />}>
            <CheckCircle2 className="size-4" />
            View your result
          </Button>
        ) : null}
      </div>
    );
  }

  // Submitted and nothing open in this session: there is nothing to do but wait.
  if (assessment.myStatus === "SUBMITTED" && !attempt) {
    return (
      <div className="space-y-6">
        {breadcrumb}
        {header}
        <Alert>
          <Clock className="size-4" />
          <AlertTitle>Awaiting review</AlertTitle>
          <AlertDescription>
            Your answers are with your tutor. You will see the result and their feedback once it is marked.
          </AlertDescription>
        </Alert>
        {assessment.latestAttemptId ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/student/attempts/${assessment.latestAttemptId}`} />}
          >
            View your submission
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {breadcrumb}
      {header}

      {assessment.instructions.trim() ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Instructions</h2>
          <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{assessment.instructions}</p>
        </section>
      ) : null}

      {attempt ? (
        assessment.type === "MCQ" ? (
          <McqAttemptForm
            assessment={assessment}
            attempt={attempt}
            onSubmitted={(result) => {
              invalidate();
              router.push(`/student/attempts/${result.id}`);
            }}
          />
        ) : (
          <DocumentAttemptPanel
            assessment={assessment}
            attempt={attempt}
            onSubmitted={(result) => {
              setAttempt(result);
              invalidate();
            }}
          />
        )
      ) : (
        <section className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              {assessment.myStatus === "IN_PROGRESS"
                ? "Pick up where you left off"
                : assessment.myStatus === "FAILED"
                  ? "Try again"
                  : "Before you start"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {assessment.type === "MCQ"
                ? "Answer every question, then submit. You will see your score straight away."
                : "Read the question paper on screen, write your answers, then upload them as a single PDF."}
              {assessment.timeLimitMinutes
                ? ` You have ${assessment.timeLimitMinutes} minutes once you begin; answers are submitted automatically when time runs out.`
                : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              You can retry as many times as you need. Your best score is the one that counts.
            </p>
            {assessment.bestScorePercent !== null ? (
              <p className="text-sm font-medium text-foreground">Best so far: {assessment.bestScorePercent}%</p>
            ) : null}
          </div>
          <Button disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
            {startMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {assessment.myStatus === "IN_PROGRESS" ? "Continue" : assessment.myStatus === "FAILED" ? "Start a new attempt" : "Start"}
          </Button>
        </section>
      )}
    </div>
  );
}
