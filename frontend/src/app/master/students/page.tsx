"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ActiveStatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { studentsApi } from "@/lib/api/students.api";
import { formatDate, getInitials } from "@/lib/utils/format";
import type { Student } from "@/types/people";

export default function MasterStudentsPage() {
  const router = useRouter();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["master", "students", { page, pageSize, search }],
    queryFn: () => studentsApi.listForMaster({ page, pageSize, search }),
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
    { id: "courses", header: "Enrolled courses", cell: (student) => student.enrolledCoursesCount },
    { id: "status", header: "Status", cell: (student) => <ActiveStatusBadge isActive={student.isActive} /> },
    { id: "joined", header: "Joined", cell: (student) => formatDate(student.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Everyone who learns. Click a student to manage their account." />
      <SearchInput value={search} onChange={setSearch} placeholder="Search students by name or email" />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(student) => student.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No students found"
        onRowClick={(student) => router.push(`/master/users?search=${encodeURIComponent(student.email)}`)}
        rowAriaLabel={(student) => `Manage ${student.firstName} ${student.lastName}`}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
    </div>
  );
}
