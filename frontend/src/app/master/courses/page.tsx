"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { CourseStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { masterCoursesApi } from "@/lib/api/courses.api";
import { formatDate } from "@/lib/utils/format";
import { CourseStatus, type Course } from "@/types/course";

export default function MasterCoursesPage() {
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [viewingId, setViewingId] = React.useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["master", "courses", { page, pageSize, search, statusFilter }],
    queryFn: () =>
      masterCoursesApi.list({
        page,
        pageSize,
        search,
        status: statusFilter === "ALL" ? undefined : (statusFilter as CourseStatus),
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["master", "courses", viewingId],
    queryFn: () => masterCoursesApi.getById(viewingId!),
    enabled: !!viewingId,
  });

  const columns: DataTableColumn<Course>[] = [
    { id: "title", header: "Course", cell: (course) => <span className="font-medium text-foreground">{course.title}</span> },
    { id: "tutor", header: "Tutor", cell: (course) => `${course.tutor.firstName} ${course.tutor.lastName}` },
    { id: "status", header: "Status", cell: (course) => <CourseStatusBadge status={course.status} /> },
    { id: "lessons", header: "Lessons", cell: (course) => course.lessonsCount },
    { id: "students", header: "Students", cell: (course) => course.enrollmentsCount },
    { id: "updated", header: "Last updated", cell: (course) => formatDate(course.updatedAt) },
    {
      id: "actions",
      header: "",
      headerClassName: "w-16",
      cell: (course) => (
        <Button size="icon-sm" variant="ghost" aria-label="View" onClick={() => setViewingId(course.id)}>
          <Eye className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Courses" description="Every course across all tutors." />

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
        emptyTitle="No courses found"
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}

      <Sheet open={!!viewingId} onOpenChange={(open) => !open && setViewingId(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Course details</SheetTitle>
            <SheetDescription>Read-only overview of this course.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-4">
            {detailQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            ) : detailQuery.data ? (
              <>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{detailQuery.data.title}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <CourseStatusBadge status={detailQuery.data.status} />
                    <span className="text-xs text-muted-foreground">
                      by {detailQuery.data.tutor.firstName} {detailQuery.data.tutor.lastName}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{detailQuery.data.description}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Lessons</p>
                    <p className="text-lg font-semibold text-foreground">{detailQuery.data.lessonsCount}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Files</p>
                    <p className="text-lg font-semibold text-foreground">{detailQuery.data.filesCount}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Enrollments</p>
                    <p className="text-lg font-semibold text-foreground">{detailQuery.data.enrollmentsCount}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium text-foreground">{formatDate(detailQuery.data.createdAt)}</p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
