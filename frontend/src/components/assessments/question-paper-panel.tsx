"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/shared/file-upload";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AssessmentFileViewerDialog } from "@/components/assessments/assessment-file-viewer";
import { PDF_ACCEPT, PDF_MAX_BYTES, assessmentsApiFor } from "@/lib/api/assessments.api";
import { formatFileSize } from "@/lib/utils/format";
import { ApiError } from "@/types/api";
import type { AssessmentFileRef, AuthoringRole } from "@/types/assessment";

interface QuestionPaperPanelProps {
  assessmentId: string;
  role: AuthoringRole;
  questionPaper: AssessmentFileRef | null;
  readOnly?: boolean;
  onChanged: () => void;
}

/** Upload, replace, preview or remove the PDF a DOCUMENT assessment hands out. */
export function QuestionPaperPanel({
  assessmentId,
  role,
  questionPaper,
  readOnly = false,
  onChanged,
}: QuestionPaperPanelProps) {
  const api = assessmentsApiFor(role);
  const [progress, setProgress] = React.useState(0);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadQuestionPaper(assessmentId, file, setProgress),
    onSuccess: () => {
      toast.success("Question paper uploaded");
      setProgress(0);
      onChanged();
    },
    onError: (error) => {
      setProgress(0);
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload the paper. Please try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => api.deleteQuestionPaper(assessmentId, fileId),
    onSuccess: () => {
      toast.success("Question paper removed");
      setConfirmDelete(false);
      onChanged();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove the paper. Please try again."),
  });

  return (
    <div className="space-y-3">
      {questionPaper ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
          <FileText className="size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{questionPaper.originalName}</p>
            <p className="text-xs text-muted-foreground">PDF · {formatFileSize(questionPaper.sizeBytes)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setViewerOpen(true)}>
              <Eye className="size-3.5" />
              View
            </Button>
            {!readOnly ? (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                aria-label="Remove question paper"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No question paper yet. A document assessment cannot be published without one.
        </p>
      )}

      {!readOnly ? (
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
      ) : null}
      {!readOnly ? (
        <p className="text-xs text-muted-foreground">
          PDF only. Uploading a new paper replaces the current one. Students can read it but never download it.
        </p>
      ) : null}

      {questionPaper ? (
        <AssessmentFileViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          file={questionPaper}
          queryKey={[role, "assessment-file", questionPaper.id]}
          loadStreamUrl={() => api.fileStreamUrl(questionPaper.id)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Remove this question paper?"
        description="Students will no longer be able to open it, and the assessment cannot stay published without a paper."
        confirmLabel="Remove paper"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (questionPaper) deleteMutation.mutate(questionPaper.id);
        }}
      />
    </div>
  );
}
