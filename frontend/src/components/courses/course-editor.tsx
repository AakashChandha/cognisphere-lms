"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  UploadCloud,
  Archive,
  Trash2,
  Undo2,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  RotateCcw,
  Ban,
  Power,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CourseStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import { CourseLessonsManager } from "@/components/tutor/course-lessons-manager";
import { CourseFilesManager } from "@/components/tutor/course-files-manager";
import { CourseStudentsManager } from "@/components/tutor/course-students-manager";
import { CourseAssessmentsManager } from "@/components/assessments/course-assessments-manager";
import { CoverImagePicker, ProgressionModeField } from "@/components/courses/course-create-form";
import { ReassignTutorDialog } from "@/components/master/reassign-tutor-dialog";
import { DeactivateCourseDialog } from "@/components/master/deactivate-course-dialog";
import { Label } from "@/components/ui/label";
import {
  masterCoursesApi,
  removeCourseThumbnail,
  tutorCoursesApi,
  uploadCourseThumbnail,
} from "@/lib/api/courses.api";
import { formatDate, pluralize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { CourseStatus } from "@/types/course";
import { ApiError } from "@/types/api";

const updateCourseSchema = z.object({
  title: z.string().trim().min(1, "Course title is required").max(160, "Keep the title under 160 characters"),
  description: z.string().trim().min(10, "Write at least a sentence so students know what the course covers"),
  thumbnailUrl: z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
  progressionMode: z.enum(["FREE", "SEQUENTIAL"]),
});

type UpdateCourseValues = z.infer<typeof updateCourseSchema>;
type TabValue = "lessons" | "files" | "assessments" | "students" | "details";
const TABS: TabValue[] = ["lessons", "files", "assessments", "students", "details"];
type ConfirmAction = "publish" | "unpublish" | "archive" | "delete" | "reactivate";

export interface CourseEditorProps {
  courseId: string;
  /** Where the course pages live for the current role; drives breadcrumbs, tab URLs and the redirect after delete. */
  basePath: "/tutor/courses" | "/master/courses";
  /** Admin view: tutor assignment, deactivate/reactivate, and editing a deactivated course. */
  isMaster: boolean;
}

function CourseEditorContent({ courseId, basePath, isMaster }: CourseEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(null);
  const [reassignOpen, setReassignOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);

  const requestedTab = searchParams.get("tab");
  const activeTab: TabValue = TABS.includes(requestedTab as TabValue) ? (requestedTab as TabValue) : "lessons";

  function setTab(tab: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(`${basePath}/${courseId}?${next.toString()}`, { scroll: false });
  }

  // Admins go through the tutor endpoints too (the backend lifts the ownership check for MASTER).
  const courseQuery = useQuery({
    queryKey: ["tutor", "courses", courseId],
    queryFn: () => tutorCoursesApi.getById(courseId),
  });

  const form = useForm<UpdateCourseValues>({
    resolver: zodResolver(updateCourseSchema),
    defaultValues: { title: "", description: "", thumbnailUrl: "", progressionMode: "FREE" },
  });

  const thumbnailValue = useWatch({ control: form.control, name: "thumbnailUrl" });

  React.useEffect(() => {
    if (courseQuery.data) {
      form.reset({
        title: courseQuery.data.title,
        description: courseQuery.data.description,
        thumbnailUrl: courseQuery.data.thumbnailUrl ?? "",
        progressionMode: courseQuery.data.progressionMode ?? "FREE",
      });
    }
  }, [courseQuery.data, form]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
    if (isMaster) {
      void queryClient.invalidateQueries({ queryKey: ["master", "courses"] });
      void queryClient.invalidateQueries({ queryKey: ["master", "dashboard"] });
    }
  }

  const updateMutation = useMutation({
    mutationFn: (values: UpdateCourseValues) =>
      tutorCoursesApi.update(courseId, {
        title: values.title,
        description: values.description,
        thumbnailUrl: values.thumbnailUrl || undefined,
        progressionMode: values.progressionMode,
      }),
    onSuccess: () => {
      toast.success("Course details saved");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't save the course. Please try again."),
  });

  // The course already exists here, so a chosen cover goes straight to the
  // server and the form's URL field follows what comes back.
  const thumbnailRole = isMaster ? "master" : "tutor";

  const uploadThumbnailMutation = useMutation({
    mutationFn: (file: File) => uploadCourseThumbnail(thumbnailRole, courseId, file),
    onSuccess: (result) => {
      form.setValue("thumbnailUrl", result.thumbnailUrl);
      toast.success("Cover image updated");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't upload the cover image. Please try again."),
  });

  const removeThumbnailMutation = useMutation({
    mutationFn: () => removeCourseThumbnail(thumbnailRole, courseId),
    onSuccess: () => {
      form.setValue("thumbnailUrl", "");
      toast.success("Cover image removed");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses", courseId] });
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove the cover image. Please try again."),
  });

  const publishMutation = useMutation({
    mutationFn: () => tutorCoursesApi.publish(courseId),
    onSuccess: () => {
      toast.success("Course published. Enrolled students can now open it.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't publish the course. Please try again."),
    onSettled: () => setConfirmAction(null),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => tutorCoursesApi.unpublish(courseId),
    onSuccess: () => {
      toast.success("Course moved back to draft. Students can no longer open it.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't unpublish the course. Please try again."),
    onSettled: () => setConfirmAction(null),
  });

  const archiveMutation = useMutation({
    mutationFn: () => tutorCoursesApi.archive(courseId),
    onSuccess: () => {
      toast.success("Course archived");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't archive the course. Please try again."),
    onSettled: () => setConfirmAction(null),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tutorCoursesApi.remove(courseId),
    onSuccess: () => {
      toast.success("Course deleted");
      invalidate();
      router.push(basePath);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete the course. Please try again."),
    onSettled: () => setConfirmAction(null),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => masterCoursesApi.reactivate(courseId),
    onSuccess: () => {
      toast.success("Course reactivated as a draft. Publish it when it is ready.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't reactivate the course. Please try again."),
    onSettled: () => setConfirmAction(null),
  });

  if (courseQuery.isLoading) return <FullPageSpinner />;
  if (courseQuery.isError || !courseQuery.data) {
    return <ErrorState onRetry={() => void courseQuery.refetch()} />;
  }

  const course = courseQuery.data;
  const isPublished = course.status === CourseStatus.PUBLISHED;
  const isArchived = course.status === CourseStatus.ARCHIVED;
  const isDeactivated = course.status === CourseStatus.DEACTIVATED;
  // Tutors can look at a deactivated course but every mutation would be refused with 403.
  const readOnly = isDeactivated && !isMaster;
  const canPublish = course.lessonsCount > 0 && !isDeactivated;
  const listLabel = isMaster ? "Courses" : "My courses";

  const checklist = [
    { label: "Course details", done: true },
    { label: course.lessonsCount > 0 ? pluralize(course.lessonsCount, "lesson") : "Add at least one lesson", done: course.lessonsCount > 0 },
    { label: course.filesCount > 0 ? pluralize(course.filesCount, "file") + " uploaded" : "Upload material (optional)", done: course.filesCount > 0, optional: true },
    { label: course.enrollmentsCount > 0 ? pluralize(course.enrollmentsCount, "student") + " enrolled" : "Enrol students", done: course.enrollmentsCount > 0, optional: true },
  ];

  const statusHint = isDeactivated
    ? isMaster
      ? "Switched off. Students cannot open it and the tutor cannot edit it until you reactivate."
      : "Switched off by the admin. You can read everything but not make changes."
    : isPublished
      ? "Enrolled students can open this course."
      : isArchived
        ? "Hidden from new enrolments. Students already enrolled keep access."
        : isMaster
          ? "Only the tutor and admins can see this course until it is published."
          : "Only you can see this course until you publish it.";

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: listLabel, href: basePath }, { label: course.title }]} />

      {isDeactivated ? (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <Ban />
          <AlertTitle>This course is deactivated</AlertTitle>
          <AlertDescription>
            <p>
              {course.deactivationReason ? `Reason: ${course.deactivationReason}` : "No reason was recorded."}
              {course.deactivatedAt ? ` Deactivated on ${formatDate(course.deactivatedAt)}.` : ""}
            </p>
            <p>
              {isMaster
                ? "Students cannot open it and the tutor can view but not edit it. Reactivating returns it to draft."
                : "Students cannot open it and you cannot make changes. Contact the admin to reactivate it."}
            </p>
            {isMaster ? (
              <div className="pt-1">
                <Button size="sm" variant="outline" onClick={() => setConfirmAction("reactivate")}>
                  <Power className="size-3.5" />
                  Reactivate
                </Button>
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{course.title}</h1>
            <CourseStatusBadge status={course.status} />
          </div>
          <p className="text-sm text-muted-foreground">{statusHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDeactivated && isMaster ? (
            <Button size="sm" onClick={() => setConfirmAction("reactivate")}>
              <Power className="size-3.5" />
              Reactivate
            </Button>
          ) : !isPublished && !isDeactivated ? (
            <Button
              size="sm"
              onClick={() => setConfirmAction("publish")}
              disabled={!canPublish}
              title={canPublish ? undefined : "Add a lesson before publishing"}
            >
              {isArchived ? <RotateCcw className="size-3.5" /> : <UploadCloud className="size-3.5" />}
              {isArchived ? "Restore and publish" : "Publish"}
            </Button>
          ) : null}
          {!readOnly ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="outline" aria-label="More course actions" />}>
                <MoreHorizontal className="size-4" />
                More
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isPublished ? (
                  <DropdownMenuItem onClick={() => setConfirmAction("unpublish")}>
                    <Undo2 /> Unpublish (back to draft)
                  </DropdownMenuItem>
                ) : null}
                {!isArchived && !isDeactivated ? (
                  <DropdownMenuItem onClick={() => setConfirmAction("archive")}>
                    <Archive /> Archive
                  </DropdownMenuItem>
                ) : null}
                {isMaster && !isDeactivated ? (
                  <DropdownMenuItem variant="destructive" onClick={() => setDeactivateOpen(true)}>
                    <Ban /> Deactivate course
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmAction("delete")}>
                  <Trash2 /> Delete course
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {isMaster ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tutor</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {course.tutor ? (
                <p className="text-sm font-medium text-foreground">
                  {course.tutor.firstName} {course.tutor.lastName}
                </p>
              ) : (
                <>
                  <StatusBadge tone="warning">Unassigned</StatusBadge>
                  <span className="text-sm text-muted-foreground">Nobody but admins can edit this course.</span>
                </>
              )}
            </div>
          </div>
          <Button size="sm" variant={course.tutor ? "outline" : "default"} onClick={() => setReassignOpen(true)} className="shrink-0">
            <UserCog className="size-3.5" />
            {course.tutor ? "Change tutor" : "Assign a tutor"}
          </Button>
        </div>
      ) : null}

      {!isPublished && !isDeactivated ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Ready to publish?</p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                {item.done ? (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Circle className={cn("size-4", item.optional ? "text-muted-foreground/50" : "text-amber-500")} />
                )}
                <span className={cn(item.done ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setTab(String(value))}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="lessons">Lessons ({course.lessonsCount})</TabsTrigger>
          <TabsTrigger value="files">Files ({course.filesCount})</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="students">Students ({course.enrollmentsCount})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="mt-4">
          <CourseLessonsManager courseId={courseId} readOnly={readOnly} progressionMode={course.progressionMode} />
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <CourseFilesManager courseId={courseId} readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          <CourseAssessmentsManager courseId={courseId} role={isMaster ? "master" : "tutor"} readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <CourseStudentsManager courseId={courseId} readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Course details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))} className="max-w-2xl space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Title <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input disabled={readOnly} {...field} />
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
                        <FormLabel>
                          Description <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea rows={5} disabled={readOnly} {...field} />
                        </FormControl>
                        <FormDescription>Shown to students on the course page.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="progressionMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How students move through the lessons</FormLabel>
                        <ProgressionModeField
                          value={field.value}
                          onChange={field.onChange}
                          name="edit-progression-mode"
                          disabled={readOnly}
                        />
                        <FormDescription>
                          Switching to in-order locks lessons for students who have not reached them yet.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label>Cover image</Label>
                    <CoverImagePicker
                      previewUrl={thumbnailValue || null}
                      onFileChosen={(file) => uploadThumbnailMutation.mutate(file)}
                      onRemove={() => {
                        // An uploaded cover lives on the server; a pasted URL
                        // only lives in this form.
                        if (course.thumbnailUrl?.startsWith("/api/files/thumbnail/")) {
                          removeThumbnailMutation.mutate();
                        } else {
                          form.setValue("thumbnailUrl", "");
                        }
                      }}
                      disabled={readOnly}
                      isBusy={uploadThumbnailMutation.isPending || removeThumbnailMutation.isPending}
                    />
                    <FormField
                      control={form.control}
                      name="thumbnailUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-normal text-muted-foreground">
                            Or paste an image URL
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="https://..." disabled={readOnly} {...field} />
                          </FormControl>
                          <FormDescription>
                            An upload replaces whatever is here. Save the form to keep a pasted URL.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {readOnly ? (
                    <p className="text-sm text-muted-foreground">Details cannot be changed while the course is deactivated.</p>
                  ) : (
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                      Save changes
                    </Button>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmAction === "publish"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={isArchived ? `Restore and publish "${course.title}"?` : `Publish "${course.title}"?`}
        description={`Enrolled students will be able to open the course and its ${pluralize(course.lessonsCount, "lesson")}. You can unpublish at any time.`}
        confirmLabel={isArchived ? "Restore and publish" : "Publish"}
        isLoading={publishMutation.isPending}
        onConfirm={() => publishMutation.mutate()}
      />
      <ConfirmDialog
        open={confirmAction === "unpublish"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`Unpublish "${course.title}"?`}
        description={`The course goes back to draft. ${pluralize(course.enrollmentsCount, "enrolled student")} will no longer be able to open it until it is published again.`}
        confirmLabel="Unpublish"
        isLoading={unpublishMutation.isPending}
        onConfirm={() => unpublishMutation.mutate()}
      />
      <ConfirmDialog
        open={confirmAction === "archive"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`Archive "${course.title}"?`}
        description="Archived courses are hidden from new enrolments but students already enrolled keep access. You can restore it later."
        confirmLabel="Archive"
        isLoading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
      />
      <ConfirmDialog
        open={confirmAction === "delete"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`Delete "${course.title}"?`}
        description={`This permanently deletes the course, its ${pluralize(course.lessonsCount, "lesson")} and ${pluralize(course.filesCount, "file")}. ${pluralize(course.enrollmentsCount, "enrolled student")} will lose access. This cannot be undone.`}
        confirmLabel="Delete course"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      {isMaster ? (
        <>
          <ConfirmDialog
            open={confirmAction === "reactivate"}
            onOpenChange={(open) => !open && setConfirmAction(null)}
            title={`Reactivate "${course.title}"?`}
            description="The course comes back as a draft: the tutor can edit it straight away, and students see it again once it is published."
            confirmLabel="Reactivate"
            isLoading={reactivateMutation.isPending}
            onConfirm={() => reactivateMutation.mutate()}
          />
          <ReassignTutorDialog course={course} open={reassignOpen} onOpenChange={setReassignOpen} />
          <DeactivateCourseDialog course={course} open={deactivateOpen} onOpenChange={setDeactivateOpen} />
        </>
      ) : null}
    </div>
  );
}

// Wrapped here rather than in each page: the editor reads ?lesson= via
// useSearchParams(), which needs a Suspense boundary at build time.
export function CourseEditor(props: CourseEditorProps) {
  return (
    <React.Suspense fallback={<FullPageSpinner label="Loading course..." />}>
      <CourseEditorContent {...props} />
    </React.Suspense>
  );
}
