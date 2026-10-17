"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QUERY_BODY_MAX } from "@/components/queries/query-reply-box";
import { studentLessonsApi } from "@/lib/api/lessons.api";
import type { CreateQueryPayload } from "@/types/query";

/** Sentinel for "this is about the course as a whole", which the API stores as null. */
const WHOLE_COURSE = "__whole_course__";

const askSchema = z.object({
  courseId: z.string().min(1, "Choose the course your question is about"),
  /** Either a lesson id or the whole-course sentinel. */
  lessonId: z.string(),
  title: z
    .string()
    .trim()
    .min(3, "Give your question a short title (at least 3 characters)")
    .max(200, "Keep the title under 200 characters"),
  body: z
    .string()
    .trim()
    .min(1, "Write your question so your tutor knows what to help with")
    .max(QUERY_BODY_MAX, `Keep your question under ${QUERY_BODY_MAX} characters`),
});

type AskQueryFormValues = z.infer<typeof askSchema>;

export interface QueryCourseOption {
  id: string;
  title: string;
}

interface AskQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The courses this student is enrolled in. */
  courses: QueryCourseOption[];
  coursesLoading?: boolean;
  isSubmitting: boolean;
  onSubmit: (payload: CreateQueryPayload) => void;
}

const EMPTY_DEFAULTS: AskQueryFormValues = {
  courseId: "",
  lessonId: WHOLE_COURSE,
  title: "",
  body: "",
};

export function AskQueryDialog({
  open,
  onOpenChange,
  courses,
  coursesLoading = false,
  isSubmitting,
  onSubmit,
}: AskQueryDialogProps) {
  const form = useForm<AskQueryFormValues>({
    resolver: zodResolver(askSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  React.useEffect(() => {
    // Every opening starts from a blank question.
    if (open) form.reset(EMPTY_DEFAULTS);
  }, [open, form]);

  const courseId = useWatch({ control: form.control, name: "courseId" });

  const lessonsQuery = useQuery({
    queryKey: ["student", "courses", courseId, "lessons"],
    queryFn: () => studentLessonsApi.listForCourse(courseId),
    enabled: open && !!courseId,
  });

  const lessons = React.useMemo(
    () => [...(lessonsQuery.data ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [lessonsQuery.data],
  );

  const courseItems = React.useMemo(
    () => Object.fromEntries(courses.map((course) => [course.id, course.title])),
    [courses],
  );

  const lessonItems = React.useMemo(() => {
    const items: Record<string, string> = { [WHOLE_COURSE]: "The course as a whole" };
    for (const lesson of lessons) items[lesson.id] = lesson.title;
    return items;
  }, [lessons]);

  const noCourses = courses.length === 0 && !coursesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ask a question</DialogTitle>
          <DialogDescription>
            Your tutor answers in the app. Say which course it is about, and which lesson if that helps.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              onSubmit({
                courseId: values.courseId,
                lessonId: values.lessonId === WHOLE_COURSE ? null : values.lessonId,
                title: values.title.trim(),
                body: values.body.trim(),
              }),
            )}
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <FormField
                control={form.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Course <span className="text-destructive">*</span>
                    </FormLabel>
                    {/* `null` rather than "" so the placeholder shows until a course is picked. */}
                    <Select
                      items={courseItems}
                      value={field.value || null}
                      onValueChange={(value) => {
                        field.onChange(value ?? "");
                        // A lesson of the old course would be meaningless here.
                        form.setValue("lessonId", WHOLE_COURSE);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" disabled={coursesLoading || noCourses}>
                          <SelectValue placeholder={coursesLoading ? "Loading your courses..." : "Choose a course"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {noCourses
                        ? "You are not enrolled in any course yet, so there is nothing to ask about."
                        : "Only the courses you are enrolled in are listed."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lessonId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lesson (optional)</FormLabel>
                    <Select
                      items={lessonItems}
                      value={field.value || WHOLE_COURSE}
                      onValueChange={(value) => field.onChange(value ?? WHOLE_COURSE)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" disabled={!courseId || lessonsQuery.isLoading}>
                          <SelectValue
                            placeholder={lessonsQuery.isLoading ? "Loading lessons..." : "The course as a whole"}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={WHOLE_COURSE}>The course as a whole</SelectItem>
                        {lessons.map((lesson) => (
                          <SelectItem key={lesson.id} value={lesson.id}>
                            {lesson.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {courseId
                        ? "Pointing at a lesson helps your tutor answer faster."
                        : "Pick a course first to see its lessons."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. How is risk rating calculated?" {...field} />
                    </FormControl>
                    <FormDescription>One short line, so your tutor can see at a glance what it is about.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Your question <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        placeholder="Explain what you are stuck on, and what you have already tried."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || noCourses}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Send question
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
