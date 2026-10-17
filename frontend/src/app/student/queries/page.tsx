"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessagesSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { AskQueryDialog } from "@/components/queries/ask-query-dialog";
import { QueryStatusBadge, queryStatusHint } from "@/components/queries/query-badges";
import { studentQueriesApi } from "@/lib/api/queries.api";
import { studentCoursesApi } from "@/lib/api/courses.api";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime, pluralize } from "@/lib/utils/format";
import { ApiError } from "@/types/api";
import type { CreateQueryPayload, QueryStatus, QuerySummary } from "@/types/query";

const ALL_STATUSES = "ALL";
const ALL_COURSES = "ALL";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: ALL_STATUSES, label: "All questions" },
  { value: "ANSWERED", label: "Answered — read the reply" },
  { value: "OPEN", label: "Open — waiting for a tutor" },
  { value: "RESOLVED", label: "Resolved" },
];

const STATUS_ITEMS: Record<string, string> = Object.fromEntries(
  STATUS_FILTERS.map((filter) => [filter.value, filter.label]),
);

/**
 * The student's own questions, newest activity first, plus the one place they
 * raise a new one. Answered threads are tinted so "my tutor has replied" is
 * visible without reading a word.
 */
export default function StudentQueriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [status, setStatus] = React.useState<string>(ALL_STATUSES);
  const [courseFilter, setCourseFilter] = React.useState<string>(ALL_COURSES);
  const [askOpen, setAskOpen] = React.useState(false);

  // The enrolled courses serve both the filter and the "ask a question" form.
  const coursesQuery = useQuery({
    queryKey: ["student", "courses", "for-queries"],
    queryFn: () => studentCoursesApi.list({ page: 1, pageSize: 100 }),
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
    queryKey: ["student", "queries", { page, pageSize, search, status, courseFilter }],
    queryFn: () =>
      studentQueriesApi.list({
        page,
        pageSize,
        search,
        status: status === ALL_STATUSES ? undefined : (status as QueryStatus),
        courseId: courseFilter === ALL_COURSES ? undefined : courseFilter,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateQueryPayload) => studentQueriesApi.create(payload),
    onSuccess: (created) => {
      setAskOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["student", "queries"] });
      toast.success("Your question has been sent to your tutor.");
      router.push(`/student/queries/${created.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Couldn't send your question. Please try again."),
  });

  const isFiltered = !!search || status !== ALL_STATUSES || courseFilter !== ALL_COURSES;
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Queries"
        description="Questions you have asked your tutors, and their replies. Ask as many as you need."
        actions={
          <Button onClick={() => setAskOpen(true)}>
            <Plus className="size-4" />
            Ask a question
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchInput value={search} onChange={setSearch} placeholder="Search your questions" />

        <div className="space-y-1.5">
          <Label htmlFor="student-queries-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select
            items={STATUS_ITEMS}
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? ALL_STATUSES);
              setPage(1);
            }}
          >
            <SelectTrigger id="student-queries-status" className="w-full sm:w-60">
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
          <Label htmlFor="student-queries-course" className="text-xs text-muted-foreground">
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
            <SelectTrigger id="student-queries-course" className="w-full sm:w-72">
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

      {isError ? (
        <ErrorState
          title="Couldn't load your questions"
          description="The list didn't load. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={isFiltered ? "Nothing matches those filters" : "No questions yet"}
          description={
            isFiltered
              ? "Try a different status or course, or clear the search to see everything you have asked."
              : "Stuck on something? Ask your tutor here and their reply appears in this list."
          }
          action={
            isFiltered ? null : (
              <Button onClick={() => setAskOpen(true)}>
                <Plus className="size-4" />
                Ask a question
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <StudentQueryCard item={item} />
              </li>
            ))}
          </ul>
          {data ? (
            <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
          ) : null}
        </>
      )}

      <AskQueryDialog
        open={askOpen}
        onOpenChange={setAskOpen}
        courses={courses}
        coursesLoading={coursesQuery.isLoading}
        isSubmitting={createMutation.isPending}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />
    </div>
  );
}

function StudentQueryCard({ item }: { item: QuerySummary }) {
  const needsReading = item.status === "ANSWERED";

  return (
    <Link
      href={`/student/queries/${item.id}`}
      className={cn(
        "press-subtle block rounded-xl border bg-card p-4 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
        needsReading ? "border-info/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{item.title}</p>
        <QueryStatusBadge status={item.status} />
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {item.courseTitle}
        {item.lessonTitle ? ` · ${item.lessonTitle}` : " · Whole course"}
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.lastMessagePreview}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className={needsReading ? "font-medium text-info" : undefined}>
          {queryStatusHint(item.status, "student")}
        </span>
        {" · "}
        {pluralize(item.messageCount, "message")}
        {" · "}
        <span title={formatDateTime(item.lastMessageAt)}>{formatRelativeTime(item.lastMessageAt)}</span>
      </p>
    </Link>
  );
}
