"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { AttemptStatusBadge, formatScore } from "@/components/assessments/assessment-badges";
import { assessmentsApiFor } from "@/lib/api/assessments.api";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { formatDateTime } from "@/lib/utils/format";
import type { AttemptStatus, AttemptSummary, AuthoringRole } from "@/types/assessment";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "SUBMITTED", label: "Awaiting review" },
  { value: "ALL", label: "All attempts" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "PASSED", label: "Passed" },
  { value: "FAILED", label: "Not passed" },
];

const STATUS_ITEMS: Record<string, string> = Object.fromEntries(
  STATUS_FILTERS.map((filter) => [filter.value, filter.label]),
);

/**
 * The queue a tutor lives in: every submitted attempt across their courses,
 * or the attempts of one assessment when `assessmentId` is given.
 */
export function AttemptReviewQueue({
  role,
  assessmentId = null,
}: {
  role: AuthoringRole;
  assessmentId?: string | null;
}) {
  const api = assessmentsApiFor(role);
  const router = useRouter();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [status, setStatus] = React.useState<string>("SUBMITTED");

  const statusParam = status === "ALL" ? undefined : (status as AttemptStatus);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [role, "assessment-attempts", { assessmentId, page, pageSize, search, status }],
    queryFn: () =>
      assessmentId
        ? api.listAttempts(assessmentId, { page, pageSize, search, status: statusParam })
        : api.listAllAttempts({ page, pageSize, search, status: statusParam }),
  });

  const assessmentQuery = useQuery({
    queryKey: [role, "assessments", assessmentId],
    queryFn: () => api.getById(assessmentId as string),
    enabled: !!assessmentId,
  });

  const columns: DataTableColumn<AttemptSummary>[] = [
    {
      id: "student",
      header: "Student",
      cell: (attempt) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {attempt.student.firstName} {attempt.student.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{attempt.student.email}</p>
        </div>
      ),
    },
    {
      id: "assessment",
      header: "Assessment",
      cell: (attempt) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">{attempt.assessmentTitle}</p>
          <p className="truncate text-xs text-muted-foreground">{attempt.courseTitle}</p>
        </div>
      ),
    },
    { id: "attempt", header: "Attempt", cell: (attempt) => `#${attempt.attemptNumber}` },
    { id: "status", header: "Status", cell: (attempt) => <AttemptStatusBadge status={attempt.status} /> },
    { id: "score", header: "Score", cell: (attempt) => formatScore(attempt.scorePercent) },
    {
      id: "submitted",
      header: "Submitted",
      cell: (attempt) => (attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={assessmentId ? (assessmentQuery.data?.title ?? "Attempts") : "Assessments"}
        description={
          assessmentId
            ? "Every attempt at this assessment. Open one to read it and record a mark."
            : "Submissions waiting to be marked, across all your courses."
        }
        actions={
          assessmentId ? (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/${role}/assessments`} />}>
              <ArrowLeft className="size-3.5" />
              All assessments
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by student or assessment" />
        <Select
          items={STATUS_ITEMS}
          value={status}
          onValueChange={(value) => {
            setStatus(value ?? "SUBMITTED");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Status" />
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

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(attempt) => attempt.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage="We couldn't load the review queue. Please try again."
        onRetry={() => void refetch()}
        emptyTitle={status === "SUBMITTED" ? "Nothing to review" : "No attempts found"}
        emptyDescription={
          status === "SUBMITTED"
            ? "Every submission has been marked. New ones will appear here."
            : "Try a different status or search term."
        }
        onRowClick={(attempt) => router.push(`/${role}/attempts/${attempt.id}`)}
        rowAriaLabel={(attempt) =>
          `Open ${attempt.student.firstName} ${attempt.student.lastName}'s attempt at ${attempt.assessmentTitle}`
        }
        renderCard={(attempt) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-medium text-foreground">
                {attempt.student.firstName} {attempt.student.lastName}
              </p>
              <AttemptStatusBadge status={attempt.status} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {attempt.assessmentTitle} · {attempt.courseTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              Attempt #{attempt.attemptNumber} · {formatScore(attempt.scorePercent)}
              {attempt.submittedAt ? ` · ${formatDateTime(attempt.submittedAt)}` : ""}
            </p>
          </div>
        )}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
    </div>
  );
}
