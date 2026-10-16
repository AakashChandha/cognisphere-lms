"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, UserCog, UserX } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { CourseStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import { ReassignTutorDialog } from "@/components/master/reassign-tutor-dialog";
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
import { masterCoursesApi } from "@/lib/api/courses.api";
import { formatDate, pluralize } from "@/lib/utils/format";
import { CourseStatus, type Course } from "@/types/course";

const STATUS_ITEMS: Record<string, string> = {
  ALL: "All statuses",
  [CourseStatus.DRAFT]: "Draft",
  [CourseStatus.PUBLISHED]: "Published",
  [CourseStatus.ARCHIVED]: "Archived",
  [CourseStatus.DEACTIVATED]: "Deactivated",
};

function TutorCell({ course }: { course: Course }) {
  if (!course.tutor) {
    return <StatusBadge tone="warning">Unassigned</StatusBadge>;
  }
  return (
    <span>
      {course.tutor.firstName} {course.tutor.lastName}
    </span>
  );
}

export default function MasterCoursesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();

  const statusParam = searchParams.get("status");
  const statusFilter = statusParam && statusParam in STATUS_ITEMS ? statusParam : "ALL";
  const unassignedOnly = searchParams.get("unassigned") === "true";
  const [reassignTarget, setReassignTarget] = React.useState<Course | null>(null);

  function updateFilters(next: { status?: string; unassigned?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status !== undefined) {
      if (next.status === "ALL") params.delete("status");
      else params.set("status", next.status);
    }
    if (next.unassigned !== undefined) {
      if (next.unassigned) params.set("unassigned", "true");
      else params.delete("unassigned");
    }
    const query = params.toString();
    router.replace(`/master/courses${query ? `?${query}` : ""}`, { scroll: false });
    setPage(1);
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["master", "courses", { page, pageSize, search, statusFilter, unassignedOnly }],
    queryFn: () =>
      masterCoursesApi.list({
        page,
        pageSize,
        search,
        status: statusFilter === "ALL" ? undefined : (statusFilter as CourseStatus),
        unassigned: unassignedOnly ? "true" : undefined,
      }),
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
          <DropdownMenuItem onClick={() => router.push(`/master/courses/${course.id}`)}>
            <Pencil /> Manage
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setReassignTarget(course)}>
            <UserCog /> {course.tutor ? "Change tutor" : "Assign a tutor"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns: DataTableColumn<Course>[] = [
    {
      id: "title",
      header: "Course",
      cell: (course) => (
        <Link href={`/master/courses/${course.id}`} className="font-medium text-foreground hover:underline">
          {course.title}
        </Link>
      ),
    },
    { id: "tutor", header: "Tutor", cell: (course) => <TutorCell course={course} /> },
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
        title="Courses"
        description="Every course across all tutors. Open one to edit it exactly as its tutor would."
        actions={
          <Button nativeButton={false} render={<Link href="/master/courses/new" />}>
            <Plus className="size-4" />
            New course
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search courses by title" />
        <Select items={STATUS_ITEMS} value={statusFilter} onValueChange={(value) => updateFilters({ status: value ?? "ALL" })}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={unassignedOnly ? "default" : "outline"}
          aria-pressed={unassignedOnly}
          onClick={() => updateFilters({ unassigned: !unassignedOnly })}
        >
          <UserX className="size-4" />
          Unassigned only
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(course) => course.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle={unassignedOnly ? "No unassigned courses" : "No courses found"}
        emptyDescription={unassignedOnly ? "Every course has a tutor." : "Try adjusting your search or filters."}
        onRowClick={(course) => router.push(`/master/courses/${course.id}`)}
        rowAriaLabel={(course) => `Open "${course.title}"`}
        renderCard={(course) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate font-medium text-foreground">{course.title}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <CourseStatusBadge status={course.status} />
                <TutorCell course={course} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{pluralize(course.lessonsCount, "lesson")}</span>
                <span>·</span>
                <span>{pluralize(course.enrollmentsCount, "student")}</span>
                <span>·</span>
                <span>Updated {formatDate(course.updatedAt)}</span>
              </div>
            </div>
            <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              {renderActions(course)}
            </div>
          </div>
        )}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}

      <ReassignTutorDialog
        course={reassignTarget}
        open={!!reassignTarget}
        onOpenChange={(open) => !open && setReassignTarget(null)}
      />
    </div>
  );
}
