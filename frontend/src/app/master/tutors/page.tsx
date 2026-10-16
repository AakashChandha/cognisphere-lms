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
import { tutorsApi } from "@/lib/api/tutors.api";
import { formatDate, getInitials } from "@/lib/utils/format";
import type { Tutor } from "@/types/people";

export default function MasterTutorsPage() {
  const router = useRouter();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["master", "tutors", { page, pageSize, search }],
    queryFn: () => tutorsApi.listForMaster({ page, pageSize, search }),
  });

  const columns: DataTableColumn<Tutor>[] = [
    {
      id: "tutor",
      header: "Tutor",
      cell: (tutor) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback>{getInitials(tutor.firstName, tutor.lastName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">
              {tutor.firstName} {tutor.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{tutor.email}</p>
          </div>
        </div>
      ),
    },
    { id: "expertise", header: "Expertise", cell: (tutor) => tutor.expertise ?? "—" },
    { id: "courses", header: "Courses", cell: (tutor) => tutor.coursesCount },
    { id: "status", header: "Status", cell: (tutor) => <ActiveStatusBadge isActive={tutor.isActive} /> },
    { id: "joined", header: "Joined", cell: (tutor) => formatDate(tutor.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Tutors" description="Everyone who teaches. Click a tutor to manage their account." />
      <SearchInput value={search} onChange={setSearch} placeholder="Search tutors by name or email" />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(tutor) => tutor.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No tutors found"
        onRowClick={(tutor) => router.push(`/master/users?search=${encodeURIComponent(tutor.email)}`)}
        rowAriaLabel={(tutor) => `Manage ${tutor.firstName} ${tutor.lastName}`}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
    </div>
  );
}
