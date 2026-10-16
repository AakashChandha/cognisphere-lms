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
import { formatDate, pluralize } from "@/lib/utils/format";
import { CourseStatus, type Course } from "@/types/course";
import { ApiError } from "@/types/api";

const STATUS_ITEMS: Record<string, string> = {
  ALL: "All statuses",
  [CourseStatus.DRAFT]: "Draft",
  [CourseStatus.PUBLISHED]: "Published",
  [CourseStatus.ARCHIVED]: "Archived",
  [CourseStatus.DEACTIVATED]: "Deactivated",
};

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
      toast.success("Course published");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to publish course"),
    onSettled: () => setPendingAction(null),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => tutorCoursesApi.archive(id),
    onSuccess: () => {
      toast.success("Course archived");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to archive course"),
    onSettled: () => setPendingAction(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tutorCoursesApi.remove(id),
    onSuccess: () => {
      toast.success("Course deleted");
      void queryClient.invalidateQueries({ queryKey: ["tutor", "courses"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete course"),
    onSettled: () => setPendingAction(null),
  });

  function renderActions(course: Course) {
    return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for "${course.title}"`}>
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/tutor/courses/${course.id}`)}>
              <Pencil /> {course.status === CourseStatus.DEACTIVATED ? "View" : "Manage"}
            </DropdownMenuItem>
            {course.status === CourseStatus.DEACTIVATED ? (
              <DropdownMenuItem disabled>Deactivated by the admin</DropdownMenuItem>
            ) : null}
            {course.status !== CourseStatus.PUBLISHED && course.status !== CourseStatus.DEACTIVATED ? (
              <DropdownMenuItem
                disabled={course.lessonsCount === 0}
                onClick={() => setPendingAction({ course, type: "publish" })}
              >
                <UploadCloud /> {course.status === CourseStatus.ARCHIVED ? "Restore and publish" : "Publish"}
              </DropdownMenuItem>
            ) : null}
            {course.status !== CourseStatus.ARCHIVED && course.status !== CourseStatus.DEACTIVATED ? (
              <DropdownMenuItem onClick={() => setPendingAction({ course, type: "archive" })}>
                <Archive /> Archive
              </DropdownMenuItem>
            ) : null}
            {course.status !== CourseStatus.DEACTIVATED ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setPendingAction({ course, type: "delete" })}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
    );
  }

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
      stopRowClick: true,
      cell: renderActions,
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
        <Select items={STATUS_ITEMS} value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "ALL")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
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
        onRowClick={(course) => router.push(`/tutor/courses/${course.id}`)}
        rowAriaLabel={(course) => `Open "${course.title}"`}
        renderCard={(course) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate font-medium text-foreground">{course.title}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <CourseStatusBadge status={course.status} />
                <span>{pluralize(course.lessonsCount, "lesson")}</span>
                <span>·</span>
                <span>{pluralize(course.enrollmentsCount, "student")}</span>
              </div>
              <p className="text-xs text-muted-foreground">Updated {formatDate(course.updatedAt)}</p>
            </div>
            <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              {renderActions(course)}
            </div>
          </div>
        )}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}

      <ConfirmDialog
        open={pendingAction?.type === "publish"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction ? `Publish "${pendingAction.course.title}"?` : "Publish this course?"}
        description="Students you enrol will be able to open the course. You can unpublish at any time."
        confirmLabel="Publish"
        isLoading={publishMutation.isPending}
        onConfirm={() => {
          if (pendingAction) publishMutation.mutate(pendingAction.course.id);
        }}
      />
      <ConfirmDialog
        open={pendingAction?.type === "archive"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction ? `Archive "${pendingAction.course.title}"?` : "Archive this course?"}
        description="Archived courses are hidden from new enrolments but students already enrolled keep access."
        confirmLabel="Archive"
        isLoading={archiveMutation.isPending}
        onConfirm={() => {
          if (pendingAction) archiveMutation.mutate(pendingAction.course.id);
        }}
      />
      <ConfirmDialog
        open={pendingAction?.type === "delete"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction ? `Delete "${pendingAction.course.title}"?` : "Delete this course?"}
        description={
          pendingAction
            ? `This permanently deletes the course, its ${pluralize(pendingAction.course.lessonsCount, "lesson")} and files. ${pluralize(pendingAction.course.enrollmentsCount, "enrolled student")} will lose access. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete course"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingAction) deleteMutation.mutate(pendingAction.course.id);
        }}
      />
    </div>
  );
}
