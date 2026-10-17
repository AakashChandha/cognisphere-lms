"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ErrorState } from "@/components/shared/error-state";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { AttemptResultView } from "@/components/assessments/attempt-result-view";
import { assessmentsApiFor } from "@/lib/api/assessments.api";
import { cn } from "@/lib/utils";
import { ApiError } from "@/types/api";
import type { AttemptDetail, AuthoringRole } from "@/types/assessment";

const gradeSchema = z.object({
  outcome: z.enum(["pass", "fail"], { error: "Choose pass or not yet" }),
  scorePercent: z
    .union([z.literal(""), z.number().int("Use a whole number").min(0, "0 at the lowest").max(100, "100 at the most")])
    .optional(),
  feedback: z
    .string()
    .trim()
    .min(1, "Write feedback so the student knows why")
    .max(4000, "Keep feedback under 4000 characters"),
});

type GradeFormValues = z.infer<typeof gradeSchema>;

/** Read one submission and mark it. Shared by the tutor and admin routes. */
export function AttemptReviewPanel({ attemptId, role }: { attemptId: string; role: AuthoringRole }) {
  const api = assessmentsApiFor(role);
  const queryClient = useQueryClient();
  const attemptKey = React.useMemo(() => [role, "attempts", attemptId], [role, attemptId]);

  const { data: attempt, isLoading, isError, refetch } = useQuery({
    queryKey: attemptKey,
    queryFn: () => api.getAttempt(attemptId),
  });

  const gradeMutation = useMutation({
    mutationFn: (values: GradeFormValues) =>
      api.gradeAttempt(attemptId, {
        passed: values.outcome === "pass",
        scorePercent: typeof values.scorePercent === "number" ? values.scorePercent : undefined,
        feedback: values.feedback,
      }),
    onSuccess: (result) => {
      toast.success(result.status === "PASSED" ? "Marked as passed" : "Marked as not passed");
      queryClient.setQueryData(attemptKey, result);
      void queryClient.invalidateQueries({ queryKey: [role, "assessment-attempts"] });
      void queryClient.invalidateQueries({ queryKey: [role, "assessments"] });
      void queryClient.invalidateQueries({ queryKey: [role, "courses"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the mark. Please try again."),
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
        title="Couldn't load this attempt"
        description="It may have been deleted, or you may not have access to it."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "Assessments", href: `/${role}/assessments` },
          { label: attempt.assessmentTitle, href: `/${role}/assessments?assessmentId=${attempt.assessmentId}` },
          { label: `${attempt.student.firstName} ${attempt.student.lastName}` },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {attempt.student.firstName} {attempt.student.lastName}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5" />
            <span className="truncate">{attempt.student.email}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/${role}/assessments`} />}
          className="shrink-0"
        >
          <ArrowLeft className="size-3.5" />
          Back to the queue
        </Button>
      </div>

      <AttemptResultView attempt={attempt} viewer={role} showStudent />

      {attempt.assessmentType === "DOCUMENT" ? (
        <GradeForm
          attempt={attempt}
          isSubmitting={gradeMutation.isPending}
          onSubmit={(values) => gradeMutation.mutate(values)}
        />
      ) : (
        <Alert>
          <AlertTitle>Marked automatically</AlertTitle>
          <AlertDescription>
            Multiple-choice tests are marked the moment the student submits, so there is nothing to mark here.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function GradeForm({
  attempt,
  isSubmitting,
  onSubmit,
}: {
  attempt: AttemptDetail;
  isSubmitting: boolean;
  onSubmit: (values: GradeFormValues) => void;
}) {
  const isGraded = attempt.status === "PASSED" || attempt.status === "FAILED";

  const form = useForm<GradeFormValues>({
    resolver: zodResolver(gradeSchema),
    defaultValues: {
      outcome: attempt.status === "PASSED" ? "pass" : attempt.status === "FAILED" ? "fail" : undefined,
      scorePercent: attempt.scorePercent ?? "",
      feedback: attempt.feedback ?? "",
    },
  });

  const outcome = useWatch({ control: form.control, name: "outcome" });

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{isGraded ? "Update the mark" : "Mark this submission"}</h2>
        <p className="text-sm text-muted-foreground">
          Read the PDF above, then record the outcome. Feedback is required — it is the only thing the student gets
          back besides a result.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="outcome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Outcome <span className="text-destructive">*</span>
                </FormLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => field.onChange("pass")}
                    aria-pressed={outcome === "pass"}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-colors",
                      outcome === "pass"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border hover:bg-muted/60",
                    )}
                  >
                    <CheckCircle2 className="size-4" />
                    Passed
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("fail")}
                    aria-pressed={outcome === "fail"}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-colors",
                      outcome === "fail"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border hover:bg-muted/60",
                    )}
                  >
                    <XCircle className="size-4" />
                    Not passed
                  </button>
                </div>
                <FormDescription>
                  The student may retake this as often as they like until they pass; their best score counts.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="scorePercent"
            render={({ field }) => (
              <FormItem className="max-w-40">
                <FormLabel>Score</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    placeholder="Optional"
                    value={field.value === undefined ? "" : field.value}
                    onChange={(event) => field.onChange(event.target.value === "" ? "" : event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormDescription>Percent, optional.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="feedback"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Feedback <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder="What was done well, what was missing, and what to do before trying again."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isGraded ? "Save the mark" : "Record the mark"}
          </Button>
        </form>
      </Form>
    </section>
  );
}
