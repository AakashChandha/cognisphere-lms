"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { QueryStatusBadge } from "@/components/queries/query-badges";
import { masterCoursesApi, tutorCoursesApi } from "@/lib/api/courses.api";
import { staffQueriesApiFor } from "@/lib/api/queries.api";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";
import type { QueryStaffRole, QueryStatus, QuerySummary } from "@/types/query";

const ALL_STATUSES = "ALL";
const ALL_COURSES = "ALL";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "OPEN", label: "Open — needs a reply" },
  { value: ALL_STATUSES, label: "All questions" },
  { value: "ANSWERED", label: "Answered — with the student" },
  { value: "RESOLVED", label: "Resolved" },
];

const STATUS_ITEMS: Record<string, string> = Object.fromEntries(
  STATUS_FILTERS.map((filter) => [filter.value, filter.label]),
);

/**
 * The staff work queue: every question a tutor can see (their own courses) or
 * an admin can see (all courses). The API sorts OPEN threads first, so the
 * oldest unanswered question is never buried under resolved ones.
 */
export function QueriesInbox({ role }: { role: QueryStaffRole }) {
  const router = useRouter();
  const api = React.useMemo(() => staffQueriesApiFor(role), [role]);
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [status, setStatus] = React.useState<string>("OPEN");
  const [courseFilter, setCourseFilter] = React.useState<string>(ALL_COURSES);

  const coursesQuery = useQuery({
    queryKey: [role, "courses", "for-queries"],
    queryFn: () =>
      role === "master"
        ? masterCoursesApi.list({ page: 1, pageSize: 100 })
        : tutorCoursesApi.list({ page: 1, pageSize: 100 }),
  });

  const courses = React.useMemo(
    () => (coursesQuery.data?.items ?? []).map((course) => ({ id: course.id, title: course.title })),
    [coursesQuery.data],
  );

  const courseItems = React.useMemo(() => {
    const items: Record<string, string> = { [ALL_COURSES]: "All courses" };
    for (const course of courses) items[course.id] = course.title;
    return items;
  }, [courses]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [role, "queries", { page, pageSize, search, status, courseFilter }],
    queryFn: () =>
      api.list({
        page,
        pageSize,
        search,
        status: status === ALL_STATUSES ? undefined : (status as QueryStatus),
        courseId: courseFilter === ALL_COURSES ? undefined : courseFilter,
      }),
  });

  const columns: DataTableColumn<QuerySummary>[] = [
    {
      id: "student",
      header: "Student",
      cell: (item) => <p className="truncate font-medium text-foreground">{item.studentName}</p>,
    },
    {
      id: "question",
      header: "Question",
      cell: (item) => (
        <div className="min-w-0 max-w-sm">
          <p className="truncate text-foreground">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">{item.lastMessagePreview}</p>
        </div>
      ),
    },
    {
      id: "course",
      header: "Course",
      cell: (item) => (
        <div className="min-w-0 max-w-56">
          <p className="truncate text-foreground">{item.courseTitle}</p>
          <p className="truncate text-xs text-muted-foreground">{item.lessonTitle ?? "Whole course"}</p>
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (item) => <QueryStatusBadge status={item.status} /> },
    {
      id: "activity",
      header: "Last activity",
      cell: (item) => (
        <span title={formatDateTime(item.lastMessageAt)} className="whitespace-nowrap">
          {formatRelativeTime(item.lastMessageAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Queries"
        description={
          role === "master"
            ? "Questions students have raised on any course. Open means a reply is still owed."
            : "Questions students have raised on your courses. Open means a reply is still owed."
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by question or student" />

        <div className="space-y-1.5">
          <Label htmlFor="queries-status-filter" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select
            items={STATUS_ITEMS}
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? "OPEN");
              setPage(1);
            }}
          >
            <SelectTrigger id="queries-status-filter" className="w-full sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="queries-course-filter" className="text-xs text-muted-foreground">
            Course
          </Label>
          <Select
            items={courseItems}
            value={courseFilter}
            onValueChange={(value) => {
              setCourseFilter(value ?? ALL_COURSES);
              setPage(1);
            }}
          >
            <SelectTrigger id="queries-course-filter" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COURSES}>All courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(item) => item.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage="We couldn't load the queries inbox. Please try again."
        onRetry={() => void refetch()}
        emptyTitle={status === "OPEN" ? "Nothing waiting on you" : "No questions found"}
        emptyDescription={
          status === "OPEN"
            ? "Every question has been answered. New ones appear here as students ask them."
            : "Try a different status, course or search term."
        }
        onRowClick={(item) => router.push(`/${role}/queries/${item.id}`)}
        rowAriaLabel={(item) => `Open ${item.studentName}'s question: ${item.title}`}
        renderCard={(item) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-medium text-foreground">{item.title}</p>
              <QueryStatusBadge status={item.status} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {item.studentName} · {item.courseTitle}
              {item.lessonTitle ? ` · ${item.lessonTitle}` : ""}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{item.lastMessagePreview}</p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(item.lastMessageAt)}</p>
          </div>
        )}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
    </div>
  );
}
