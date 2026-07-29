"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SearchInput } from "@/components/shared/search-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { tutorCoursesApi } from "@/lib/api/courses.api";
import { tutorsApi } from "@/lib/api/tutors.api";
import { getInitials } from "@/lib/utils/format";
import type { Student } from "@/types/people";
import { ApiError } from "@/types/api";

export function CourseStudentsManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const enrolledKey = ["tutor", "courses", courseId, "students"];
  const [enrollDialogOpen, setEnrollDialogOpen] = React.useState(false);
  const [unenrollTarget, setUnenrollTarget] = React.useState<Student | null>(null);
  const { search, setSearch } = usePaginationState();

  const { data: enrolled, isLoading, isError, refetch } = useQuery({
    queryKey: enrolledKey,
    queryFn: () => tutorCoursesApi.listStudents(courseId, { pageSize: 100 }),
  });

  const directoryQuery = useQuery({
    queryKey: ["tutor", "students", "directory", { search }],
    queryFn: () => tutorsApi.listStudentDirectory({ pageSize: 20, search }),
    enabled: enrollDialogOpen,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: enrolledKey });
    void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
  }

  const enrollMutation = useMutation({
    mutationFn: (studentId: string) => tutorCoursesApi.enrollStudent(courseId, studentId),
    onSuccess: () => {
      toast.success("Student enrolled successfully");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to enroll student"),
  });

  const unenrollMutation = useMutation({
    mutationFn: (studentId: string) => tutorCoursesApi.unenrollStudent(courseId, studentId),
    onSuccess: () => {
      toast.success("Student removed from course");
      setUnenrollTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to remove student"),
  });

  const enrolledIds = new Set((enrolled?.items ?? []).map((s) => s.id));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEnrollDialogOpen(true)}>
          <UserPlus className="size-3.5" />
          Enroll student
        </Button>
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : enrolled!.items.length === 0 ? (
        <EmptyState icon={Users} title="No students enrolled yet" />
      ) : (
        <div className="space-y-2">
          {enrolled!.items.map((student) => (
            <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{student.email}</p>
                </div>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => setUnenrollTarget(student)} aria-label="Remove">
                <UserMinus className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll a student</DialogTitle>
          </DialogHeader>
          <SearchInput value={search} onChange={setSearch} placeholder="Search students by name or email..." />
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {directoryQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : directoryQuery.data?.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No students found.</p>
            ) : (
              directoryQuery.data?.items.map((student) => {
                const alreadyEnrolled = enrolledIds.has(student.id);
                return (
                  <button
                    key={student.id}
                    type="button"
                    disabled={alreadyEnrolled || enrollMutation.isPending}
                    onClick={() => enrollMutation.mutate(student.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {alreadyEnrolled ? "Enrolled" : "Add"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!unenrollTarget}
        onOpenChange={(open) => !open && setUnenrollTarget(null)}
        title="Remove this student from the course?"
        description="They will lose access to this course's lessons and materials."
        confirmLabel="Remove"
        destructive
        isLoading={unenrollMutation.isPending}
        onConfirm={() => {
          if (unenrollTarget) unenrollMutation.mutate(unenrollTarget.id);
        }}
      />
    </div>
  );
}
