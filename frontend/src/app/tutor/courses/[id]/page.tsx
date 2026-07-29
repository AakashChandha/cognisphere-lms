"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, UploadCloud, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PageHeader } from "@/components/shared/page-header";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CourseStatusBadge } from "@/components/shared/status-badge";
import { CourseLessonsManager } from "@/components/tutor/course-lessons-manager";
import { CourseFilesManager } from "@/components/tutor/course-files-manager";
import { CourseStudentsManager } from "@/components/tutor/course-students-manager";
import { tutorCoursesApi } from "@/lib/api/courses.api";
import { CourseStatus } from "@/types/course";
import { ApiError } from "@/types/api";

const updateCourseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(160),
  description: z.string().min(10, "Description must be at least 10 characters"),
  thumbnailUrl: z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
});

type UpdateCourseValues = z.infer<typeof updateCourseSchema>;

export default function TutorCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const courseId = params.id;
  const [confirmAction, setConfirmAction] = React.useState<"publish" | "archive" | "delete" | null>(null);

  const courseQuery = useQuery({
    queryKey: ["tutor", "courses", courseId],
    queryFn: () => tutorCoursesApi.getById(courseId),
  });

  const form = useForm<UpdateCourseValues>({
    resolver: zodResolver(updateCourseSchema),
    defaultValues: { title: "", description: "", thumbnailUrl: "" },
  });

  React.useEffect(() => {
    if (courseQuery.data) {
      form.reset({
        title: courseQuery.data.title,
        description: courseQuery.data.description,
        thumbnailUrl: courseQuery.data.thumbnailUrl ?? "",
      });
    }
  }, [courseQuery.data, form]);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateCourseValues) =>
      tutorCoursesApi.update(courseId, {
        title: values.title,
        description: values.description,
        thumbnailUrl: values.thumbnailUrl || undefined,
      }),
    onSuccess: () => {
      toast.success("Course updated successfully");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update course"),
  });

  const publishMutation = useMutation({
    mutationFn: () => tutorCoursesApi.publish(courseId),
    onSuccess: () => {
      toast.success("Course published successfully");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to publish course"),
    onSettled: () => setConfirmAction(null),
  });

  const archiveMutation = useMutation({
    mutationFn: () => tutorCoursesApi.archive(courseId),
    onSuccess: () => {
      toast.success("Course archived successfully");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to archive course"),
    onSettled: () => setConfirmAction(null),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tutorCoursesApi.remove(courseId),
    onSuccess: () => {
      toast.success("Course deleted successfully");
      router.push("/tutor/courses");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete course"),
    onSettled: () => setConfirmAction(null),
  });

  if (courseQuery.isLoading) return <FullPageSpinner />;
  if (courseQuery.isError || !courseQuery.data) {
    return <ErrorState onRetry={() => void courseQuery.refetch()} />;
  }

  const course = courseQuery.data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/tutor/courses")}>
        <ArrowLeft className="size-4" />
        Back to courses
      </Button>

      <PageHeader
        title={course.title}
        description="Manage course details, lessons, files and enrolled students."
        actions={
          <>
            <CourseStatusBadge status={course.status} />
            {course.status !== CourseStatus.PUBLISHED ? (
              <Button size="sm" variant="outline" onClick={() => setConfirmAction("publish")}>
                <UploadCloud className="size-3.5" />
                Publish
              </Button>
            ) : null}
            {course.status !== CourseStatus.ARCHIVED ? (
              <Button size="sm" variant="outline" onClick={() => setConfirmAction("archive")}>
                <Archive className="size-3.5" />
                Archive
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setConfirmAction("delete")}>
              <Trash2 className="size-3.5 text-destructive" />
              Delete
            </Button>
          </>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="lessons">Lessons ({course.lessonsCount})</TabsTrigger>
          <TabsTrigger value="files">Files ({course.filesCount})</TabsTrigger>
          <TabsTrigger value="students">Students ({course.enrollmentsCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Course details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Textarea rows={5} {...field} />
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
                        <FormLabel>Thumbnail URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lessons" className="mt-4">
          <CourseLessonsManager courseId={courseId} />
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <CourseFilesManager courseId={courseId} />
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <CourseStudentsManager courseId={courseId} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmAction === "publish"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Publish this course?"
        description="Once published, students will be able to view and enroll in this course."
        confirmLabel="Publish"
        isLoading={publishMutation.isPending}
        onConfirm={() => publishMutation.mutate()}
      />
      <ConfirmDialog
        open={confirmAction === "archive"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Archive this course?"
        description="Archived courses are hidden from new enrollments but remain accessible to enrolled students."
        confirmLabel="Archive"
        isLoading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
      />
      <ConfirmDialog
        open={confirmAction === "delete"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Delete this course?"
        description="This will permanently delete the course, its lessons and files. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
