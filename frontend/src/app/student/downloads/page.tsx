"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Download as DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { studentFilesApi, downloadFile } from "@/lib/api/course-files.api";
import { formatDate, formatFileSize } from "@/lib/utils/format";
import type { CourseFile } from "@/types/course-file";
import { ApiError } from "@/types/api";

export default function StudentDownloadsPage() {
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "files", { page, pageSize, search }],
    queryFn: () => studentFilesApi.listAll({ page, pageSize, search }),
  });

  async function handleDownload(file: CourseFile) {
    try {
      await downloadFile(file.downloadUrl, file.originalName);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to download file");
    }
  }

  const columns: DataTableColumn<CourseFile>[] = [
    {
      id: "name",
      header: "File",
      cell: (file) => (
        <div className="flex items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="max-w-64 truncate font-medium text-foreground">{file.originalName}</span>
        </div>
      ),
    },
    { id: "course", header: "Course", cell: (file) => file.courseTitle },
    { id: "size", header: "Size", cell: (file) => formatFileSize(file.sizeBytes) },
    { id: "date", header: "Uploaded", cell: (file) => formatDate(file.createdAt) },
    {
      id: "actions",
      header: "",
      headerClassName: "w-24",
      cell: (file) => (
        <Button size="sm" variant="outline" onClick={() => void handleDownload(file)}>
          <DownloadIcon className="size-3.5" />
          Download
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Downloads" description="All course materials across your enrolled courses." />
      <SearchInput value={search} onChange={setSearch} placeholder="Search files..." />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(file) => file.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No files found"
      />
      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
    </div>
  );
}
