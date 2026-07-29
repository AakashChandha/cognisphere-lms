"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AnnouncementAudience, type Announcement } from "@/types/announcement";

const announcementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(160),
  content: z.string().min(10, "Content must be at least 10 characters"),
  audience: z.nativeEnum(AnnouncementAudience),
  courseId: z.string().optional(),
});

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;

interface AnnouncementCourseOption {
  id: string;
  title: string;
}

interface AnnouncementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: Announcement | null;
  isSubmitting: boolean;
  onSubmit: (values: AnnouncementFormValues) => void;
  courses?: AnnouncementCourseOption[];
  audienceOptions?: AnnouncementAudience[];
}

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  [AnnouncementAudience.ALL]: "Everyone",
  [AnnouncementAudience.STUDENTS]: "Students",
  [AnnouncementAudience.TUTORS]: "Tutors",
};

export function AnnouncementFormDialog({
  open,
  onOpenChange,
  announcement,
  isSubmitting,
  onSubmit,
  courses,
  audienceOptions = [AnnouncementAudience.ALL, AnnouncementAudience.STUDENTS, AnnouncementAudience.TUTORS],
}: AnnouncementFormDialogProps) {
  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", content: "", audience: AnnouncementAudience.ALL, courseId: "none" },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        title: announcement?.title ?? "",
        content: announcement?.content ?? "",
        audience: announcement?.audience ?? AnnouncementAudience.ALL,
        courseId: announcement?.courseId ?? "none",
      });
    }
  }, [open, announcement, form]);

  function handleSubmit(values: AnnouncementFormValues) {
    onSubmit({ ...values, courseId: values.courseId === "none" ? undefined : values.courseId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{announcement ? "Edit announcement" : "New announcement"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Announcement title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="Announcement content" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="audience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Audience</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {audienceOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {AUDIENCE_LABEL[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {courses ? (
              <FormField
                control={form.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course (optional)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="General announcement" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">General (not course-specific)</SelectItem>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {announcement ? "Save changes" : "Post announcement"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
