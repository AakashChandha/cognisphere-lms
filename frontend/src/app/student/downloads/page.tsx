"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FileViewerDialog } from "@/components/shared/file-viewer-dialog";
import { StudentFileActions } from "@/components/shared/student-file-actions";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { studentFilesApi } from "@/lib/api/course-files.api";
import { formatDate, formatFileSize } from "@/lib/utils/format";
import type { CourseFile } from "@/types/course-file";

export default function StudentMaterialsPage() {
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [viewerFile, setViewerFile] = React.useState<CourseFile | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "files", { page, pageSize, search }],
    queryFn: () => studentFilesApi.listAll({ page, pageSize, search }),
  });

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
      headerClassName: "w-48",
      cell: (file) => (
        <StudentFileActions file={file} onView={setViewerFile} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Materials" description="View course materials across your enrolled courses." />
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

      <FileViewerDialog
        file={viewerFile}
        open={!!viewerFile}
        onOpenChange={(open) => !open && setViewerFile(null)}
      />
    </div>
  );
}
