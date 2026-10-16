"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { masterCoursesApi } from "@/lib/api/courses.api";
import { cn } from "@/lib/utils";
import type { Course } from "@/types/course";
import { ApiError } from "@/types/api";

const REASON_MIN = 3;
const REASON_MAX = 500;

const deactivateSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(REASON_MIN, `Give a reason of at least ${REASON_MIN} characters so the tutor knows what happened`)
    .max(REASON_MAX, `Keep the reason under ${REASON_MAX} characters`),
});

type DeactivateValues = z.infer<typeof deactivateSchema>;

interface DeactivateCourseDialogProps {
  course: Course | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Admin-only: switches a course off with a reason the tutor will see. */
export function DeactivateCourseDialog({ course, open, onOpenChange }: DeactivateCourseDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<DeactivateValues>({
    resolver: zodResolver(deactivateSchema),
    defaultValues: { reason: "" },
  });

  React.useEffect(() => {
    if (open) form.reset({ reason: "" });
  }, [open, form]);

  const reason = useWatch({ control: form.control, name: "reason" });
  const reasonLength = reason.length;

  const mutation = useMutation({
    mutationFn: (values: DeactivateValues) => masterCoursesApi.deactivate(course!.id, values.reason),
    onSuccess: (updated) => {
      toast.success(`"${updated.title}" deactivated. Students can no longer open it.`);
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
      void queryClient.invalidateQueries({ queryKey: ["master", "courses"] });
      void queryClient.invalidateQueries({ queryKey: ["master", "dashboard"] });
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't deactivate the course. Please try again."),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate{course ? ` "${course.title}"` : " course"}?</DialogTitle>
          <DialogDescription>
            Use this to switch a course off without deleting anything.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Students lose access immediately. The course disappears from their list.</li>
          <li>The tutor can still open the course and read everything, but cannot edit it.</li>
          <li>You can reactivate it later. It returns as a draft.</li>
        </ul>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Reason <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      maxLength={REASON_MAX}
                      placeholder="e.g. Syllabus is being rewritten for the 2026 NEBOSH specification."
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <div className="flex items-start justify-between gap-3">
                    <FormDescription>Shown to the tutor on the course page.</FormDescription>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums text-muted-foreground",
                        reasonLength > REASON_MAX && "text-destructive",
                      )}
                      aria-live="polite"
                    >
                      {reasonLength}/{REASON_MAX}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Deactivate course
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
