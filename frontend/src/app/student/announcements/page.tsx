"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AudienceBadge } from "@/components/shared/status-badge";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { announcementsApi } from "@/lib/api/announcements.api";
import { formatDateTime } from "@/lib/utils/format";

export default function StudentAnnouncementsPage() {
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["announcements", { page, pageSize, search }],
    queryFn: () => announcementsApi.list({ page, pageSize, search }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Updates from your tutors and administrators." />
      <SearchInput value={search} onChange={setSearch} placeholder="Search announcements..." />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data!.items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <>
          <div className="space-y-3">
            {data!.items.map((announcement) => (
              <Card key={announcement.id}>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-foreground">{announcement.title}</h3>
                    <AudienceBadge audience={announcement.audience} />
                  </div>
                  <p className="text-sm text-muted-foreground">{announcement.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {announcement.authorName}
                    {announcement.courseTitle ? ` · ${announcement.courseTitle}` : ""} ·{" "}
                    {formatDateTime(announcement.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <PaginationControls meta={data!.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
    </div>
  );
}
