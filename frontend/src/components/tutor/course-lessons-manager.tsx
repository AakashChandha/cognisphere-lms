"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LessonFormDialog, type LessonFormValues } from "@/components/tutor/lesson-form-dialog";
import { tutorLessonsApi } from "@/lib/api/lessons.api";
import type { Lesson } from "@/types/lesson";
import { ApiError } from "@/types/api";

export function CourseLessonsManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["tutor", "courses", courseId, "lessons"];
  const [formState, setFormState] = React.useState<{ open: boolean; lesson: Lesson | null }>({
    open: false,
    lesson: null,
  });
  const [deleteTarget, setDeleteTarget] = React.useState<Lesson | null>(null);

  const { data: lessons, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => tutorLessonsApi.listForCourse(courseId),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
  }

  const createMutation = useMutation({
    mutationFn: (values: LessonFormValues) => tutorLessonsApi.create(courseId, values),
    onSuccess: () => {
      toast.success("Lesson added successfully");
      setFormState({ open: false, lesson: null });
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to add lesson"),
  });

  const updateMutation = useMutation({
    mutationFn: (values: LessonFormValues & { id: string }) =>
      tutorLessonsApi.update(values.id, { title: values.title, content: values.content }),
    onSuccess: () => {
      toast.success("Lesson updated successfully");
      setFormState({ open: false, lesson: null });
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update lesson"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tutorLessonsApi.remove(id),
    onSuccess: () => {
      toast.success("Lesson deleted successfully");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete lesson"),
  });

  function handleSubmit(values: LessonFormValues) {
    if (formState.lesson) {
      updateMutation.mutate({ ...values, id: formState.lesson.id });
    } else {
      createMutation.mutate(values);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setFormState({ open: true, lesson: null })}>
          <Plus className="size-3.5" />
          Add lesson
        </Button>
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : lessons!.length === 0 ? (
        <EmptyState icon={FileText} title="No lessons yet" description="Add your first lesson to this course." />
      ) : (
        <div className="space-y-2">
          {lessons!.map((lesson, index) => (
            <div key={lesson.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground">{lesson.filesCount} attached file(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setFormState({ open: true, lesson })}
                  aria-label="Edit lesson"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(lesson)}
                  aria-label="Delete lesson"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LessonFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
        lesson={formState.lesson}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this lesson?"
        description="This will also remove any files attached to this lesson from being organized under it."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
