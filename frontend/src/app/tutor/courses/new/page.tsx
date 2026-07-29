"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PageHeader } from "@/components/shared/page-header";
import { tutorCoursesApi } from "@/lib/api/courses.api";
import { ApiError } from "@/types/api";

const createCourseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(160),
  description: z.string().min(10, "Description must be at least 10 characters"),
  thumbnailUrl: z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
});

type CreateCourseValues = z.infer<typeof createCourseSchema>;

export default function NewCoursePage() {
  const router = useRouter();

  const form = useForm<CreateCourseValues>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: { title: "", description: "", thumbnailUrl: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateCourseValues) =>
      tutorCoursesApi.create({
        title: values.title,
        description: values.description,
        thumbnailUrl: values.thumbnailUrl || undefined,
      }),
    onSuccess: (course) => {
      toast.success("Course created as a draft");
      router.push(`/tutor/courses/${course.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create course");
    },
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/tutor/courses")}>
        <ArrowLeft className="size-4" />
        Back to courses
      </Button>

      <PageHeader title="Create a new course" description="Start with the basics — you can add lessons and files next." />

      <Card className="max-w-2xl">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course title</FormLabel>
                    <FormControl>
                      <Input placeholder="Introduction to Web Development" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={5} placeholder="What will students learn in this course?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="thumbnailUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thumbnail URL (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Create draft course
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
