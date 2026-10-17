"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileUpload } from "@/components/shared/file-upload";
import { AssessmentFileViewerDialog } from "@/components/assessments/assessment-file-viewer";
import { PDF_ACCEPT, PDF_MAX_BYTES, studentAssessmentsApi } from "@/lib/api/assessments.api";
import { formatFileSize } from "@/lib/utils/format";
import { ApiError } from "@/types/api";
import type { AttemptDetail, StudentAssessmentDetail } from "@/types/assessment";

interface DocumentAttemptPanelProps {
  assessment: StudentAssessmentDetail;
  attempt: AttemptDetail;
  onSubmitted: (attempt: AttemptDetail) => void;
}

/** Read the paper on screen, answer it offline, upload one PDF, then wait for a tutor. */
export function DocumentAttemptPanel({ assessment, attempt, onSubmitted }: DocumentAttemptPanelProps) {
  const [paperOpen, setPaperOpen] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => studentAssessmentsApi.uploadDocument(attempt.id, file, setProgress),
    onSuccess: (result) => {
      setProgress(0);
      toast.success("Your answers were submitted. Your tutor will review them.");
      onSubmitted(result);
    },
    onError: (error) => {
      setProgress(0);
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload your answers. Please try again.");
    },
  });

  const isAwaitingReview = attempt.status === "SUBMITTED";

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Question paper</h2>
        {assessment.questionPaper ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
            <FileText className="size-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{assessment.questionPaper.originalName}</p>
              <p className="text-xs text-muted-foreground">
                PDF · {formatFileSize(assessment.questionPaper.sizeBytes)} · read on screen, no download
              </p>
            </div>
            <Button size="sm" className="shrink-0" onClick={() => setPaperOpen(true)}>
              <Eye className="size-3.5" />
              Open paper
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            The question paper is not available yet. Please contact your tutor.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Your answers</h2>
        {isAwaitingReview ? (
          <Alert>
            <Clock className="size-4" />
            <AlertTitle>Awaiting review</AlertTitle>
            <AlertDescription>
              Your answers are with your tutor. You will see the result and their feedback here once it is marked.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Write your answers, save them as a single PDF, then upload it here.
            </p>
            <FileUpload
              accept={PDF_ACCEPT}
              maxSizeBytes={PDF_MAX_BYTES}
              isUploading={uploadMutation.isPending}
              progress={progress}
              disabled={uploadMutation.isPending}
              onUpload={async (file) => {
                await uploadMutation.mutateAsync(file);
              }}
            />
            <p className="text-xs text-muted-foreground">PDF only, up to {formatFileSize(PDF_MAX_BYTES)}.</p>
          </>
        )}

        {attempt.submissions.length > 0 ? (
          <ul className="space-y-2">
            {attempt.submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <FileText className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{submission.originalName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(submission.sizeBytes)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {assessment.questionPaper ? (
        <AssessmentFileViewerDialog
          open={paperOpen}
          onOpenChange={setPaperOpen}
          file={assessment.questionPaper}
          queryKey={["student", "question-paper", assessment.id]}
          loadStreamUrl={() => studentAssessmentsApi.questionPaperStreamUrl(assessment.id)}
          description="Question paper · view only, no download"
        />
      ) : null}
    </div>
  );
}
