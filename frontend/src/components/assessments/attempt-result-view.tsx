"use client";

import * as React from "react";
import { Check, Clock, Eye, FileText, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AssessmentFileViewerDialog } from "@/components/assessments/assessment-file-viewer";
import { AttemptStatusBadge, AssessmentTypeBadge } from "@/components/assessments/assessment-badges";
import { assessmentsApiFor, studentAssessmentsApi } from "@/lib/api/assessments.api";
import { formatDateTime, formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { AttemptDetail, AttemptSubmissionFile } from "@/types/assessment";

export type AttemptViewer = "student" | "tutor" | "master";

/** Score, pass/fail, per-question review, tutor feedback and the uploaded PDFs. */
export function AttemptResultView({
  attempt,
  viewer,
  showStudent = false,
}: {
  attempt: AttemptDetail;
  viewer: AttemptViewer;
  /** Tutor and admin views name the student; the student's own view does not. */
  showStudent?: boolean;
}) {
  const isGraded = attempt.status === "PASSED" || attempt.status === "FAILED";
  const passed = attempt.status === "PASSED";

  return (
    <div className="space-y-4">
      <section
        className={cn(
          "rounded-xl border p-4 sm:p-6",
          isGraded
            ? passed
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-destructive/30 bg-destructive/5"
            : "border-border bg-card",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <AssessmentTypeBadge type={attempt.assessmentType} />
              <AttemptStatusBadge status={attempt.status} />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{attempt.assessmentTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {attempt.courseTitle} · Attempt {attempt.attemptNumber}
              {showStudent ? ` · ${attempt.student.firstName} ${attempt.student.lastName}` : ""}
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {attempt.scorePercent === null ? "—" : `${attempt.scorePercent}%`}
            </p>
            <p className="text-xs text-muted-foreground">Pass mark {attempt.passPercent}%</p>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <dt className="font-medium text-foreground">Started</dt>
            <dd>{formatDateTime(attempt.startedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Submitted</dt>
            <dd>{attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "Not submitted"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Marked</dt>
            <dd>
              {attempt.gradedAt ? formatDateTime(attempt.gradedAt) : "Not marked yet"}
              {attempt.gradedBy ? ` · ${attempt.gradedBy.firstName} ${attempt.gradedBy.lastName}` : ""}
            </dd>
          </div>
        </dl>
      </section>

      {attempt.status === "SUBMITTED" ? (
        <Alert>
          <Clock className="size-4" />
          <AlertTitle>Awaiting review</AlertTitle>
          <AlertDescription>
            {viewer === "student"
              ? "Your tutor has your answers. The result and their feedback will appear here."
              : "This submission has not been marked yet."}
          </AlertDescription>
        </Alert>
      ) : null}

      {attempt.feedback ? (
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageSquare className="size-4 text-muted-foreground" />
            Tutor feedback
          </h3>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{attempt.feedback}</p>
        </section>
      ) : null}

      {attempt.submissions.length > 0 ? (
        <SubmissionsSection attempt={attempt} viewer={viewer} />
      ) : null}

      {attempt.answers.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {viewer === "student" ? "Your answers" : "Answers given"}
          </h3>
          <ol className="space-y-2">
            {attempt.answers.map((answer, index) => {
              const chosen = answer.options.find((option) => option.id === answer.chosenOptionId) ?? null;
              // `isCorrect` only reaches the client once grading is done.
              const keyKnown = answer.options.some((option) => option.isCorrect !== undefined);
              const isRight = keyKnown ? !!chosen?.isCorrect : null;
              return (
                <li key={answer.questionId} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isRight === null
                          ? "bg-primary/10 text-primary"
                          : isRight
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {isRight === null ? index + 1 : isRight ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium whitespace-pre-line text-foreground">{answer.prompt}</p>
                      <ul className="space-y-1.5">
                        {answer.options.map((option) => {
                          const isChosen = option.id === answer.chosenOptionId;
                          return (
                            <li
                              key={option.id}
                              className={cn(
                                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                                option.isCorrect
                                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                                  : isChosen
                                    ? "border-destructive/30 bg-destructive/5 text-foreground"
                                    : "border-transparent text-muted-foreground",
                              )}
                            >
                              <span className="min-w-0 flex-1">{option.text}</span>
                              {isChosen ? (
                                <span className="shrink-0 text-xs font-medium">
                                  {viewer === "student" ? "Your answer" : "Chosen"}
                                </span>
                              ) : option.isCorrect ? (
                                <span className="shrink-0 text-xs font-medium">Correct answer</span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        {answer.chosenOptionId === null ? "Not answered · " : ""}
                        {answer.points} {answer.points === 1 ? "point" : "points"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function SubmissionsSection({ attempt, viewer }: { attempt: AttemptDetail; viewer: AttemptViewer }) {
  const [openFile, setOpenFile] = React.useState<AttemptSubmissionFile | null>(null);

  const loadStreamUrl = React.useCallback(
    (fileId: string) =>
      viewer === "student"
        ? studentAssessmentsApi.submissionStreamUrl(attempt.id, fileId)
        : assessmentsApiFor(viewer).submissionStreamUrl(attempt.id, fileId),
    [viewer, attempt.id],
  );

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        {viewer === "student" ? "What you submitted" : "Submitted answers"}
      </h3>
      <ul className="space-y-2">
        {attempt.submissions.map((submission) => (
          <li
            key={submission.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"
          >
            <FileText className="size-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{submission.originalName}</p>
              <p className="text-xs text-muted-foreground">
                PDF · {formatFileSize(submission.sizeBytes)} · uploaded {formatDateTime(submission.createdAt)}
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpenFile(submission)}>
              <Eye className="size-3.5" />
              View
            </Button>
          </li>
        ))}
      </ul>
      {openFile ? (
        <AssessmentFileViewerDialog
          open
          onOpenChange={(open) => !open && setOpenFile(null)}
          file={openFile}
          queryKey={[viewer, "attempt-file", attempt.id, openFile.id]}
          loadStreamUrl={() => loadStreamUrl(openFile.id)}
          description="Submitted answers · view only, no download"
        />
      ) : null}
    </section>
  );
}
