"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { auditLogsApi } from "@/lib/api/audit-logs.api";
import { formatDateTime, toTitleCase } from "@/lib/utils/format";
import { AuditAction, type AuditLog } from "@/types/audit-log";

const ACTION_OPTIONS = Object.values(AuditAction);
const ACTION_ITEMS: Record<string, string> = {
  ALL: "All actions",
  ...Object.fromEntries(ACTION_OPTIONS.map((action) => [action, toTitleCase(action)])),
};

export default function MasterAuditLogsPage() {
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [actionFilter, setActionFilter] = React.useState<string>("ALL");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["master", "audit-logs", { page, pageSize, search, actionFilter }],
    queryFn: () =>
      auditLogsApi.list({
        page,
        pageSize,
        search,
        action: actionFilter === "ALL" ? undefined : (actionFilter as AuditAction),
      }),
  });

  const columns: DataTableColumn<AuditLog>[] = [
    { id: "action", header: "Action", cell: (log) => toTitleCase(log.action) },
    { id: "actor", header: "Actor", cell: (log) => log.actorName ?? "System" },
    { id: "entity", header: "Entity", cell: (log) => log.entityType },
    { id: "ip", header: "IP address", cell: (log) => log.ipAddress ?? "—" },
    { id: "when", header: "When", cell: (log) => formatDateTime(log.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="A record of significant actions taken across the system." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Filter by record type, e.g. Course" />
        <Select items={ACTION_ITEMS} value={actionFilter} onValueChange={(value) => setActionFilter(value ?? "ALL")}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            {ACTION_OPTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {toTitleCase(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(log) => log.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No audit log entries found"
        renderCard={(log) => (
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-foreground">{toTitleCase(log.action)}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {log.actorName ?? "System"} · {log.entityType}
              {log.ipAddress ? ` · ${log.ipAddress}` : ""}
            </p>
          </div>
        )}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
    </div>
  );
}
