"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  AssessmentTypeBadge,
  AttemptStatusBadge,
} from "@/components/assessments/assessment-badges";
import { studentAssessmentsApi } from "@/lib/api/assessments.api";
import { pluralize } from "@/lib/utils/format";
import type { StudentAssessmentSummary } from "@/types/assessment";

/**
 * The student's view of one course's assessments: where they stand and what to
 * do next. This is the only place a student reaches an assessment from, so it
 * carries its own heading, and it is never gated on course progress — an
 * assessment can be attempted whenever the tutor has published it.
 */
export function StudentCourseAssessments({ courseId }: { courseId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "courses", courseId, "assessments"],
    queryFn: () => studentAssessmentsApi.listForCourse(courseId),
  });

  const assessments = data ?? [];

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (isError) {
    body = (
      <ErrorState
        title="Couldn't load your assessments"
        description="The list didn't load. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  } else if (assessments.length === 0) {
    body = (
      <EmptyState
        icon={ClipboardList}
        title="No assessments yet"
        description="Your tutor has not set an assessment for this course. Check back later."
      />
    );
  } else {
    body = (
      <ul className="space-y-3">
        {assessments.map((assessment) => (
          <li key={assessment.id}>
            <StudentAssessmentCard assessment={assessment} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Assessments</h2>
        <p className="text-sm text-muted-foreground">
          Tests and question papers for this course. You can take these at any time.
        </p>
      </div>
      {body}
    </section>
  );
}

function StudentAssessmentCard({ assessment }: { assessment: StudentAssessmentSummary }) {
  const takeHref = `/student/assessments/${assessment.id}`;
  const resultHref = assessment.latestAttemptId ? `/student/attempts/${assessment.latestAttemptId}` : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className="truncate text-sm font-medium text-foreground">{assessment.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <AssessmentTypeBadge type={assessment.type} />
          <AttemptStatusBadge status={assessment.myStatus} />
        </div>
        <p className="text-xs text-muted-foreground">
          Pass {assessment.passPercent}%
          {assessment.type === "MCQ" ? ` · ${pluralize(assessment.questionCount, "question")}` : ""}
          {assessment.timeLimitMinutes ? ` · ${assessment.timeLimitMinutes} min` : ""}
          {assessment.attemptsCount > 0 ? ` · ${pluralize(assessment.attemptsCount, "attempt")}` : ""}
        </p>
        {assessment.bestScorePercent !== null ? (
          <p className="text-xs font-medium text-foreground">Best score: {assessment.bestScorePercent}%</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {assessment.myStatus === "PASSED" ? (
          resultHref ? (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={resultHref} />}>
              View result
            </Button>
          ) : null
        ) : assessment.myStatus === "SUBMITTED" ? (
          <>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              Awaiting review
            </span>
            {resultHref ? (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={resultHref} />}>
                View submission
              </Button>
            ) : null}
          </>
        ) : (
          <>
            {assessment.myStatus === "FAILED" && resultHref ? (
              <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={resultHref} />}>
                View result
              </Button>
            ) : null}
            <Button size="sm" nativeButton={false} render={<Link href={takeHref} />}>
              {assessment.myStatus === "IN_PROGRESS" ? (
                <>
                  <Play className="size-3.5" />
                  Continue
                </>
              ) : assessment.myStatus === "FAILED" ? (
                <>
                  <RotateCcw className="size-3.5" />
                  Try again
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  Start
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
