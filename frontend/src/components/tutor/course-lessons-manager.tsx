"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, ArrowUp, ArrowDown, BookOpen } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LessonFormDialog, type LessonFormValues } from "@/components/tutor/lesson-form-dialog";
import { tutorLessonsApi } from "@/lib/api/lessons.api";
import { pluralize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/types/lesson";
import { ApiError } from "@/types/api";

interface CourseLessonsManagerProps {
  courseId: string;
  /** Deactivated course seen by its tutor: lessons can be opened and read, nothing can change. */
  readOnly?: boolean;
}

export function CourseLessonsManager({ courseId, readOnly = false }: CourseLessonsManagerProps) {
  const queryClient = useQueryClient();
  const queryKey = ["tutor", "courses", courseId, "lessons"];
  const [formState, setFormState] = React.useState<{ open: boolean; lesson: Lesson | null }>({
    open: false,
    lesson: null,
  });
  const [deleteTarget, setDeleteTarget] = React.useState<Lesson | null>(null);
  // Local order so a drag feels instant; the server order wins when it responds.
  const [order, setOrder] = React.useState<Lesson[] | null>(null);

  const { data: lessons, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => tutorLessonsApi.listForCourse(courseId),
  });

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(null);
  }, [lessons]);

  const visibleLessons = order ?? lessons ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
  }

  const createMutation = useMutation({
    mutationFn: (values: LessonFormValues) => tutorLessonsApi.create(courseId, values),
    onSuccess: (lesson) => {
      toast.success(`"${lesson.title}" added`);
      setFormState({ open: false, lesson: null });
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't add the lesson. Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: LessonFormValues & { id: string }) =>
      tutorLessonsApi.update(values.id, { title: values.title, content: values.content }),
    onSuccess: (lesson) => {
      toast.success(`"${lesson.title}" saved`);
      setFormState({ open: false, lesson: null });
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't save the lesson. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tutorLessonsApi.remove(id),
    onSuccess: () => {
      toast.success(deleteTarget ? `"${deleteTarget.title}" deleted` : "Lesson deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete the lesson. Please try again."),
  });

  const reorderMutation = useMutation({
    mutationFn: (lessonIds: string[]) => tutorLessonsApi.reorder(courseId, lessonIds),
    onSuccess: () => {
      toast.success("Lesson order saved");
      invalidate();
    },
    onError: (error) => {
      setOrder(null);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the new order. Please try again.");
    },
  });

  function applyOrder(next: Lesson[]) {
    setOrder(next);
    reorderMutation.mutate(next.map((l) => l.id));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= visibleLessons.length) return;
    applyOrder(arrayMove(visibleLessons, index, target));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = visibleLessons.findIndex((l) => l.id === active.id);
    const to = visibleLessons.findIndex((l) => l.id === over.id);
    if (from < 0 || to < 0) return;
    applyOrder(arrayMove(visibleLessons, from, to));
  }

  function handleSubmit(values: LessonFormValues) {
    if (formState.lesson) {
      updateMutation.mutate({ ...values, id: formState.lesson.id });
    } else {
      createMutation.mutate(values);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Students work through lessons in this order. Open a lesson to read its notes."
            : "Students work through lessons in this order. Drag the handle or use the arrows to rearrange."}
        </p>
        {!readOnly ? (
          <Button size="sm" onClick={() => setFormState({ open: true, lesson: null })}>
            <Plus className="size-3.5" />
            Add lesson
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : visibleLessons.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No lessons yet"
          description={
            readOnly
              ? "This course has no lessons."
              : "A lesson is a title plus optional notes. Add your first one, then attach a video or slides from the Files tab."
          }
          action={
            readOnly ? undefined : (
              <Button onClick={() => setFormState({ open: true, lesson: null })}>
                <Plus className="size-4" />
                Add your first lesson
              </Button>
            )
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleLessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {visibleLessons.map((lesson, index) => (
                <SortableLessonRow
                  key={lesson.id}
                  lesson={lesson}
                  index={index}
                  total={visibleLessons.length}
                  disabled={reorderMutation.isPending || readOnly}
                  readOnly={readOnly}
                  onOpen={() => setFormState({ open: true, lesson })}
                  onDelete={() => setDeleteTarget(lesson)}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <LessonFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
        lesson={formState.lesson}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        readOnly={readOnly}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : "Delete this lesson?"}
        description={
          deleteTarget && deleteTarget.filesCount > 0
            ? `The lesson notes are deleted permanently. Its ${pluralize(deleteTarget.filesCount, "file")} will stay in the course as course-wide resources.`
            : "The lesson notes are deleted permanently. This cannot be undone."
        }
        confirmLabel="Delete lesson"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

function SortableLessonRow({
  lesson,
  index,
  total,
  disabled,
  readOnly,
  onOpen,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  lesson: Lesson;
  index: number;
  total: number;
  disabled: boolean;
  readOnly: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-xl border border-border bg-card pr-2 transition-shadow",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/30",
      )}
    >
      {readOnly ? (
        <span className="w-8 shrink-0" aria-hidden />
      ) : (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="flex h-full cursor-grab touch-none items-center self-stretch px-2 text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
          aria-label={`Drag to reorder "${lesson.title}"`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left transition-colors hover:text-primary focus-visible:outline-none"
        aria-label={readOnly ? `Open "${lesson.title}"` : `Edit "${lesson.title}"`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{lesson.title}</span>
          <span className="block text-xs text-muted-foreground">
            {lesson.content.trim() ? "Has notes" : "No notes"} · {pluralize(lesson.filesCount, "file")}
          </span>
        </span>
      </button>

      {!readOnly ? (
        <div className="flex items-center gap-0.5">
          <Button size="icon-sm" variant="ghost" onClick={onMoveUp} disabled={disabled || index === 0} aria-label="Move up" className="hidden sm:inline-flex">
            <ArrowUp className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onMoveDown} disabled={disabled || index === total - 1} aria-label="Move down" className="hidden sm:inline-flex">
            <ArrowDown className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onOpen} aria-label={`Edit "${lesson.title}"`}>
            <Pencil className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label={`Delete "${lesson.title}"`}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}
