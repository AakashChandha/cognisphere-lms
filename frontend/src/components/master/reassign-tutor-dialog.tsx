"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/shared/search-input";
import { masterCoursesApi } from "@/lib/api/courses.api";
import { tutorsApi } from "@/lib/api/tutors.api";
import { getInitials } from "@/lib/utils/format";
import type { Course } from "@/types/course";
import { ApiError } from "@/types/api";

interface ReassignTutorDialogProps {
  course: Course | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Hands a course to another tutor, e.g. after the original tutor left. */
export function ReassignTutorDialog({ course, open, onOpenChange }: ReassignTutorDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");

  const tutorsQuery = useQuery({
    queryKey: ["master", "tutors", "for-reassign", { search }],
    queryFn: () => tutorsApi.listForMaster({ pageSize: 100, search }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (tutorId: string) => masterCoursesApi.reassignTutor(course!.id, tutorId),
    onSuccess: (updated) => {
      toast.success(
        updated.tutor
          ? `"${updated.title}" is now taught by ${updated.tutor.firstName} ${updated.tutor.lastName}`
          : `"${updated.title}" reassigned`,
      );
      void queryClient.invalidateQueries({ queryKey: ["master", "courses"] });
      void queryClient.invalidateQueries({ queryKey: ["master", "dashboard"] });
      // The shared course editor reads through the tutor endpoints.
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't change the tutor. Please try again."),
  });

  const tutors = (tutorsQuery.data?.items ?? []).filter((t) => t.isActive);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change tutor{course ? ` for "${course.title}"` : ""}</DialogTitle>
          <DialogDescription>
            The new tutor can edit the course and its material straight away. Students keep their access and progress.
          </DialogDescription>
        </DialogHeader>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tutors by name or email" className="sm:w-full" />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {tutorsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : tutors.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No active tutors match.</p>
          ) : (
            tutors.map((tutor) => {
              const isCurrent = course?.tutor?.id === tutor.id;
              return (
                <button
                  key={tutor.id}
                  type="button"
                  disabled={isCurrent || mutation.isPending}
                  onClick={() => mutation.mutate(tutor.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(tutor.firstName, tutor.lastName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {tutor.firstName} {tutor.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{tutor.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {isCurrent ? "Current tutor" : mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Assign"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
