"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Clock, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { studentAssessmentsApi } from "@/lib/api/assessments.api";
import { pluralize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/types/api";
import type { AttemptDetail, StudentAssessmentDetail } from "@/types/assessment";

interface McqAttemptFormProps {
  assessment: StudentAssessmentDetail;
  attempt: AttemptDetail;
  onSubmitted: (attempt: AttemptDetail) => void;
}

/** Ticks once a second only while a limit is set; returns the ms left, or null. */
function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (deadline === null) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [deadline]);

  return deadline === null ? null : Math.max(0, deadline - now);
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function McqAttemptForm({ assessment, attempt, onSubmitted }: McqAttemptFormProps) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const submittedRef = React.useRef(false);

  const deadline = React.useMemo(() => {
    if (!assessment.timeLimitMinutes) return null;
    return new Date(attempt.startedAt).getTime() + assessment.timeLimitMinutes * 60_000;
  }, [assessment.timeLimitMinutes, attempt.startedAt]);

  const remainingMs = useCountdown(deadline);

  const questions = assessment.questions;
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const unansweredCount = questions.length - answeredCount;

  const submitMutation = useMutation({
    mutationFn: () =>
      studentAssessmentsApi.submitMcq(attempt.id, {
        answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })),
      }),
    onSuccess: (result) => {
      setConfirmOpen(false);
      onSubmitted(result);
    },
    onError: (error) => {
      submittedRef.current = false;
      setConfirmOpen(false);
      toast.error(error instanceof ApiError ? error.message : "Couldn't submit your answers. Please try again.");
    },
  });

  const submitAnswers = submitMutation.mutate;

  // Out of time: send whatever is answered, exactly as a paper exam is collected.
  React.useEffect(() => {
    if (remainingMs !== 0 || submittedRef.current) return;
    submittedRef.current = true;
    toast.warning("Time is up — your answers were submitted automatically.");
    submitAnswers();
  }, [remainingMs, submitAnswers]);

  const isOutOfTime = remainingMs === 0;
  const isUrgent = remainingMs !== null && remainingMs <= 60_000;

  return (
    <div className="space-y-4">
      {deadline !== null && remainingMs !== null ? (
        <div
          className={cn(
            "sticky top-16 z-10 flex items-center justify-between gap-3 rounded-xl border px-4 py-2 backdrop-blur-sm",
            isUrgent ? "border-destructive/30 bg-destructive/10" : "border-border bg-card/90",
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock className={cn("size-4", isUrgent ? "text-destructive" : "text-muted-foreground")} />
            <span className="tabular-nums">{formatRemaining(remainingMs)}</span>
            <span className="text-muted-foreground">left</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {answeredCount} of {questions.length} answered
          </span>
        </div>
      ) : null}

      <ol className="space-y-3">
        {questions.map((question, index) => {
          const chosen = answers[question.id];
          return (
            <li key={question.id} className="rounded-xl border border-border bg-card p-4">
              <fieldset disabled={submitMutation.isPending || isOutOfTime}>
                <legend className="mb-3 flex items-start gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-medium whitespace-pre-line text-foreground">
                      {question.prompt}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {question.points} {question.points === 1 ? "point" : "points"}
                      {chosen ? "" : " · not answered yet"}
                    </span>
                  </span>
                </legend>
                <RadioGroup
                  value={chosen ?? null}
                  onValueChange={(value) => {
                    if (value) setAnswers((current) => ({ ...current, [question.id]: value }));
                  }}
                  aria-label={`Answer for question ${index + 1}`}
                  className="gap-1.5"
                >
                  {question.options.map((option) => {
                    const isChosen = chosen === option.id;
                    return (
                      <Label
                        key={option.id}
                        className={cn(
                          "cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm font-normal transition-colors",
                          isChosen ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
                        )}
                      >
                        <RadioGroupItem value={option.id} className="mt-0.5" />
                        <span className="min-w-0 flex-1 text-foreground">{option.text}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </fieldset>
            </li>
          );
        })}
      </ol>

      {unansweredCount > 0 ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>{pluralize(unansweredCount, "question")} still unanswered</AlertTitle>
          <AlertDescription>
            An unanswered question scores nothing. You can retake this test as many times as you need, and your best
            score is the one that counts.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {answeredCount} of {questions.length} answered
          {unansweredCount > 0 ? ` · ${unansweredCount} left` : " · all done"}
        </p>
        <Button
          disabled={submitMutation.isPending || questions.length === 0}
          onClick={() => setConfirmOpen(true)}
          className="sm:w-auto"
        >
          {submitMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Submit answers
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit your answers?"
        description={
          unansweredCount > 0
            ? `${unansweredCount} of ${questions.length} questions are still unanswered and will score nothing. You will see your result straight away.`
            : "You will see your result straight away."
        }
        confirmLabel="Submit"
        isLoading={submitMutation.isPending}
        onConfirm={() => {
          submittedRef.current = true;
          submitMutation.mutate();
        }}
      />
    </div>
  );
}
