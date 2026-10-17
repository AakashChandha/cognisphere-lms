"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { tutorsApi } from "@/lib/api/tutors.api";
import { formatDate, getInitials, pluralize } from "@/lib/utils/format";
import type { Student } from "@/types/people";

export default function TutorStudentsPage() {
  const router = useRouter();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tutor", "students", { page, pageSize, search }],
    queryFn: () => tutorsApi.listStudents({ page, pageSize, search }),
  });

  const columns: DataTableColumn<Student>[] = [
    {
      id: "student",
      header: "Student",
      cell: (student) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{student.email}</p>
          </div>
        </div>
      ),
    },
    { id: "courses", header: "Enrolled in", cell: (student) => pluralize(student.enrolledCoursesCount, "course") },
    { id: "joined", header: "Joined", cell: (student) => formatDate(student.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Students"
        description="Students enrolled across your courses. Click one to see how far they have got."
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search students by name or email" />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(student) => student.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No students yet"
        emptyDescription="Students appear here once you enrol them in one of your courses."
        onRowClick={(student) => router.push(`/tutor/students/${student.id}`)}
        rowAriaLabel={(student) => `View ${student.firstName} ${student.lastName}'s progress`}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
    </div>
  );
}
