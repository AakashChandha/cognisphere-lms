"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, UploadCloud, Archive, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CourseStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { tutorCoursesApi } from "@/lib/api/courses.api";
import { formatDate } from "@/lib/utils/format";
import { CourseStatus, type Course } from "@/types/course";
import { ApiError } from "@/types/api";

export default function TutorCoursesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [pendingAction, setPendingAction] = React.useState<{ course: Course; type: "publish" | "archive" | "delete" } | null>(null);

  const queryKey = ["tutor", "courses", { page, pageSize, search, statusFilter }];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      tutorCoursesApi.list({
        page,
        pageSize,
        search,
        status: statusFilter === "ALL" ? undefined : (statusFilter as CourseStatus),
      }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => tutorCoursesApi.publish(id),
    onSuccess: () => {
      toast.success("Course published successfully");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to publish course"),
    onSettled: () => setPendingAction(null),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => tutorCoursesApi.archive(id),
    onSuccess: () => {
      toast.success("Course archived successfully");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to archive course"),
    onSettled: () => setPendingAction(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tutorCoursesApi.remove(id),
    onSuccess: () => {
      toast.success("Course deleted successfully");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete course"),
    onSettled: () => setPendingAction(null),
  });

  const columns: DataTableColumn<Course>[] = [
    {
      id: "title",
      header: "Course",
      cell: (course) => (
        <Link href={`/tutor/courses/${course.id}`} className="font-medium text-foreground hover:underline">
          {course.title}
        </Link>
      ),
    },
    { id: "status", header: "Status", cell: (course) => <CourseStatusBadge status={course.status} /> },
    { id: "lessons", header: "Lessons", cell: (course) => course.lessonsCount },
    { id: "students", header: "Students", cell: (course) => course.enrollmentsCount },
    { id: "updated", header: "Last updated", cell: (course) => formatDate(course.updatedAt) },
    {
      id: "actions",
      header: "",
      headerClassName: "w-16",
      cell: (course) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/tutor/courses/${course.id}`)}>
              <Pencil /> Manage
            </DropdownMenuItem>
            {course.status !== CourseStatus.PUBLISHED ? (
              <DropdownMenuItem onClick={() => setPendingAction({ course, type: "publish" })}>
                <UploadCloud /> Publish
              </DropdownMenuItem>
            ) : null}
            {course.status !== CourseStatus.ARCHIVED ? (
              <DropdownMenuItem onClick={() => setPendingAction({ course, type: "archive" })}>
                <Archive /> Archive
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setPendingAction({ course, type: "delete" })}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Courses"
        description="Create, publish and manage your courses."
        actions={
          <Button nativeButton={false} render={<Link href="/tutor/courses/new" />}>
            <Plus className="size-4" />
            New Course
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search courses..." />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "ALL")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value={CourseStatus.DRAFT}>Draft</SelectItem>
            <SelectItem value={CourseStatus.PUBLISHED}>Published</SelectItem>
            <SelectItem value={CourseStatus.ARCHIVED}>Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(course) => course.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No courses yet"
        emptyDescription="Create your first course to get started."
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}

      <ConfirmDialog
        open={pendingAction?.type === "publish"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title="Publish this course?"
        description="Once published, students will be able to view and enroll in this course."
        confirmLabel="Publish"
        isLoading={publishMutation.isPending}
        onConfirm={() => {
          if (pendingAction) publishMutation.mutate(pendingAction.course.id);
        }}
      />
      <ConfirmDialog
        open={pendingAction?.type === "archive"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title="Archive this course?"
        description="Archived courses are hidden from new enrollments but remain accessible to enrolled students."
        confirmLabel="Archive"
        isLoading={archiveMutation.isPending}
        onConfirm={() => {
          if (pendingAction) archiveMutation.mutate(pendingAction.course.id);
        }}
      />
      <ConfirmDialog
        open={pendingAction?.type === "delete"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title="Delete this course?"
        description="This will permanently delete the course, its lessons and files. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingAction) deleteMutation.mutate(pendingAction.course.id);
        }}
      />
    </div>
  );
}
