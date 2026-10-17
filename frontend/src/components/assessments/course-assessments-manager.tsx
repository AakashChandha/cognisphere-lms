"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ClipboardList,
  Eye,
  EyeOff,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AssessmentFormDialog,
  type AssessmentFormValues,
} from "@/components/assessments/assessment-form-dialog";
import {
  QuestionFormDialog,
  type QuestionFormValues,
} from "@/components/assessments/question-form-dialog";
import { QuestionPaperPanel } from "@/components/assessments/question-paper-panel";
import {
  AssessmentStatusBadge,
  AssessmentTypeBadge,
} from "@/components/assessments/assessment-badges";
import { assessmentsApiFor } from "@/lib/api/assessments.api";
import { pluralize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/types/api";
import type {
  AssessmentDetail,
  AssessmentQuestionDto,
  AssessmentSummary,
  AuthoringRole,
} from "@/types/assessment";

interface CourseAssessmentsManagerProps {
  courseId: string;
  role: AuthoringRole;
  /** Deactivated course seen by its tutor: everything is readable, nothing can change. */
  readOnly?: boolean;
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function toPayloadLimit(value: AssessmentFormValues["timeLimitMinutes"]): number | null {
  return typeof value === "number" ? value : null;
}

/** Everything a tutor or admin does with one course's assessments. */
export function CourseAssessmentsManager({ courseId, role, readOnly = false }: CourseAssessmentsManagerProps) {
  const api = assessmentsApiFor(role);
  const queryClient = useQueryClient();
  const listKey = React.useMemo(() => [role, "courses", courseId, "assessments"], [role, courseId]);

  const [formState, setFormState] = React.useState<{ open: boolean; assessment: AssessmentSummary | null }>({
    open: false,
    assessment: null,
  });
  const [deleteTarget, setDeleteTarget] = React.useState<AssessmentSummary | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: listKey,
    queryFn: () => api.listForCourse(courseId, { pageSize: 100 }),
  });

  const assessments = data?.items ?? [];

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: listKey });
    void queryClient.invalidateQueries({ queryKey: [role, "courses", courseId] });
  }, [queryClient, listKey, role, courseId]);

  const createMutation = useMutation({
    mutationFn: (values: AssessmentFormValues) =>
      api.create(courseId, {
        type: values.type,
        title: values.title,
        instructions: values.instructions,
        passPercent: values.passPercent,
        timeLimitMinutes: toPayloadLimit(values.timeLimitMinutes),
      }),
    onSuccess: (assessment) => {
      toast.success(`"${assessment.title}" created`);
      setFormState({ open: false, assessment: null });
      setExpandedId(assessment.id);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't create the assessment. Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: AssessmentFormValues & { id: string }) =>
      api.update(values.id, {
        title: values.title,
        instructions: values.instructions,
        passPercent: values.passPercent,
        timeLimitMinutes: toPayloadLimit(values.timeLimitMinutes),
      }),
    onSuccess: (assessment) => {
      toast.success(`"${assessment.title}" saved`);
      setFormState({ open: false, assessment: null });
      void queryClient.invalidateQueries({ queryKey: [role, "assessments", assessment.id] });
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the assessment. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => {
      toast.success(deleteTarget ? `"${deleteTarget.title}" deleted` : "Assessment deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Couldn't delete the assessment. Please try again.",
      ),
  });

  const publishMutation = useMutation({
    mutationFn: (payload: { id: string; publish: boolean }) =>
      payload.publish ? api.publish(payload.id) : api.unpublish(payload.id),
    onSuccess: (assessment, payload) => {
      toast.success(payload.publish ? `"${assessment.title}" is live for students` : `"${assessment.title}" unpublished`);
      void queryClient.invalidateQueries({ queryKey: [role, "assessments", assessment.id] });
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't change the status. Please try again."),
  });

  function handleSubmit(values: AssessmentFormValues) {
    if (formState.assessment) {
      updateMutation.mutate({ ...values, id: formState.assessment.id });
    } else {
      createMutation.mutate(values);
    }
  }

  const pendingPublishId = publishMutation.isPending ? publishMutation.variables?.id : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "This course is deactivated, so its assessments cannot be changed."
            : "Multiple-choice tests mark themselves. Question papers are marked by you."}
        </p>
        {!readOnly ? (
          <Button size="sm" onClick={() => setFormState({ open: true, assessment: null })}>
            <Plus className="size-3.5" />
            New assessment
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Couldn't load the assessments"
          description="The list didn't load. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments yet"
          description={
            readOnly
              ? "This course has no assessments."
              : "Add a multiple-choice test that marks itself, or hand out a question paper students answer in a PDF."
          }
          action={
            readOnly ? undefined : (
              <Button onClick={() => setFormState({ open: true, assessment: null })}>
                <Plus className="size-4" />
                Create your first assessment
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {assessments.map((assessment) => {
            const isExpanded = expandedId === assessment.id;
            const canPublish =
              assessment.type === "MCQ" ? assessment.questionCount > 0 : assessment.hasQuestionPaper;
            const isPublishing = pendingPublishId === assessment.id;
            return (
              <li key={assessment.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : assessment.id)}
                    aria-expanded={isExpanded}
                    className="group flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                    <span className="min-w-0 space-y-1.5">
                      <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {assessment.title}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <AssessmentTypeBadge type={assessment.type} />
                        <AssessmentStatusBadge status={assessment.status} />
                        {assessment.awaitingReviewCount > 0 ? (
                          <StatusBadge tone="warning">{assessment.awaitingReviewCount} to review</StatusBadge>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {assessment.type === "MCQ"
                          ? pluralize(assessment.questionCount, "question")
                          : assessment.hasQuestionPaper
                            ? "Question paper attached"
                            : "No question paper"}
                        {" · "}
                        Pass {assessment.passPercent}%
                        {assessment.timeLimitMinutes ? ` · ${assessment.timeLimitMinutes} min` : " · No time limit"}
                        {" · "}
                        {pluralize(assessment.attemptCount, "attempt")}
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/${role}/assessments?assessmentId=${assessment.id}`} />}
                    >
                      <Inbox className="size-3.5" />
                      Attempts
                    </Button>
                    {!readOnly ? (
                      <>
                        <Button
                          size="sm"
                          variant={assessment.status === "PUBLISHED" ? "ghost" : "secondary"}
                          disabled={isPublishing || (assessment.status === "DRAFT" && !canPublish)}
                          onClick={() =>
                            publishMutation.mutate({
                              id: assessment.id,
                              publish: assessment.status !== "PUBLISHED",
                            })
                          }
                        >
                          {isPublishing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : assessment.status === "PUBLISHED" ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                          {assessment.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setFormState({ open: true, assessment })}
                          aria-label={`Edit "${assessment.title}"`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(assessment)}
                          aria-label={`Delete "${assessment.title}"`}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-border bg-muted/20 p-4">
                    <AssessmentEditorBody
                      assessmentId={assessment.id}
                      role={role}
                      readOnly={readOnly}
                      onChanged={invalidate}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AssessmentFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
        assessment={formState.assessment}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : "Delete this assessment?"}
        description={
          deleteTarget && deleteTarget.attemptCount > 0
            ? "Students have already attempted this assessment, so it cannot be deleted. Unpublish it instead."
            : "The assessment, its questions and its question paper are deleted permanently. This cannot be undone."
        }
        confirmLabel="Delete assessment"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

function AssessmentEditorBody({
  assessmentId,
  role,
  readOnly,
  onChanged,
}: {
  assessmentId: string;
  role: AuthoringRole;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const api = assessmentsApiFor(role);
  const queryClient = useQueryClient();
  const detailKey = React.useMemo(() => [role, "assessments", assessmentId], [role, assessmentId]);

  const [questionForm, setQuestionForm] = React.useState<{ open: boolean; question: AssessmentQuestionDto | null }>({
    open: false,
    question: null,
  });
  const [deleteQuestion, setDeleteQuestion] = React.useState<AssessmentQuestionDto | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: detailKey,
    queryFn: () => api.getById(assessmentId),
  });

  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: detailKey });
    onChanged();
  }, [queryClient, detailKey, onChanged]);

  const createQuestionMutation = useMutation({
    mutationFn: (values: QuestionFormValues) => api.createQuestion(assessmentId, values),
    onSuccess: () => {
      toast.success("Question added");
      setQuestionForm({ open: false, question: null });
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't add the question. Please try again."),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: (payload: { questionId: string; values: QuestionFormValues }) =>
      api.updateQuestion(assessmentId, payload.questionId, payload.values),
    onSuccess: () => {
      toast.success("Question saved");
      setQuestionForm({ open: false, question: null });
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the question. Please try again."),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => api.deleteQuestion(assessmentId, questionId),
    onSuccess: () => {
      toast.success("Question deleted");
      setDeleteQuestion(null);
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete the question. Please try again."),
  });

  const reorderMutation = useMutation({
    mutationFn: (questionIds: string[]) => api.reorderQuestions(assessmentId, questionIds),
    onSuccess: () => refresh(),
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the new order. Please try again.");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState title="Couldn't load this assessment" onRetry={() => void refetch()} />;
  }

  const questions = data.questions ?? [];

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = moveItem(questions, index, target);
    // Optimistic: the row jumps immediately, the server order wins on refetch.
    queryClient.setQueryData<AssessmentDetail>(detailKey, (previous) =>
      previous ? { ...previous, questions: next.map((q, i) => ({ ...q, orderIndex: i })) } : previous,
    );
    reorderMutation.mutate(next.map((question) => question.id));
  }

  return (
    <div className="space-y-4">
      {data.instructions.trim() ? (
        <p className="text-sm whitespace-pre-line text-muted-foreground">{data.instructions}</p>
      ) : null}

      {data.status === "DRAFT" ? (
        <Alert>
          <AlertTitle>Not visible to students</AlertTitle>
          <AlertDescription>
            {data.type === "MCQ"
              ? "Publish once you have at least one question, each with two or more options and exactly one correct answer."
              : "Publish once a question paper is attached."}
          </AlertDescription>
        </Alert>
      ) : null}

      {data.type === "DOCUMENT" ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Question paper</h3>
          <QuestionPaperPanel
            assessmentId={assessmentId}
            role={role}
            questionPaper={data.questionPaper}
            readOnly={readOnly}
            onChanged={refresh}
          />
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Questions {questions.length > 0 ? `(${questions.length})` : ""}
            </h3>
            {!readOnly ? (
              <Button size="sm" variant="outline" onClick={() => setQuestionForm({ open: true, question: null })}>
                <Plus className="size-3.5" />
                Add question
              </Button>
            ) : null}
          </div>

          {questions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No questions yet. Add the first one to make this test publishable.
            </p>
          ) : (
            <ol className="space-y-2">
              {questions.map((question, index) => (
                <li key={question.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium whitespace-pre-line text-foreground">{question.prompt}</p>
                      <ul className="space-y-1">
                        {question.options.map((option) => (
                          <li
                            key={option.id}
                            className={cn(
                              "flex items-start gap-2 text-xs",
                              option.isCorrect ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1 size-1.5 shrink-0 rounded-full",
                                option.isCorrect ? "bg-emerald-600 dark:bg-emerald-400" : "bg-muted-foreground/40",
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0">
                              {option.text}
                              {option.isCorrect ? " (correct)" : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        {question.points} {question.points === 1 ? "point" : "points"}
                      </p>
                    </div>
                    {!readOnly ? (
                      <div className="flex shrink-0 flex-col items-center gap-0.5 sm:flex-row">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={index === 0 || reorderMutation.isPending}
                          onClick={() => move(index, -1)}
                          aria-label="Move question up"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={index === questions.length - 1 || reorderMutation.isPending}
                          onClick={() => move(index, 1)}
                          aria-label="Move question down"
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setQuestionForm({ open: true, question })}
                          aria-label="Edit question"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeleteQuestion(question)}
                          aria-label="Delete question"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <QuestionFormDialog
        open={questionForm.open}
        onOpenChange={(open) => setQuestionForm((state) => ({ ...state, open }))}
        question={questionForm.question}
        isSubmitting={createQuestionMutation.isPending || updateQuestionMutation.isPending}
        onSubmit={(values) => {
          if (questionForm.question) {
            updateQuestionMutation.mutate({ questionId: questionForm.question.id, values });
          } else {
            createQuestionMutation.mutate(values);
          }
        }}
      />

      <ConfirmDialog
        open={!!deleteQuestion}
        onOpenChange={(open) => !open && setDeleteQuestion(null)}
        title="Delete this question?"
        description="The question and its options are deleted permanently. Scores already recorded are not recalculated."
        confirmLabel="Delete question"
        destructive
        isLoading={deleteQuestionMutation.isPending}
        onConfirm={() => {
          if (deleteQuestion) deleteQuestionMutation.mutate(deleteQuestion.id);
        }}
      />
    </div>
  );
}
