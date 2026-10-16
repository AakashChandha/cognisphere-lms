"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileTypeIcon, fileKindLabel } from "@/components/shared/file-type-icon";
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
          <FileTypeIcon mimeType={file.mimeType} fileName={file.originalName} className="size-4 shrink-0" />
          <span className="max-w-64 truncate font-medium text-foreground">{file.originalName}</span>
        </div>
      ),
    },
    { id: "kind", header: "Type", cell: (file) => fileKindLabel(file.mimeType, file.originalName) },
    { id: "course", header: "Course", cell: (file) => file.courseTitle },
    { id: "size", header: "Size", cell: (file) => formatFileSize(file.sizeBytes) },
    { id: "date", header: "Uploaded", cell: (file) => formatDate(file.createdAt) },
    {
      id: "actions",
      header: "",
      headerClassName: "w-48",
      stopRowClick: true,
      cell: (file) => (
        <StudentFileActions file={file} onView={setViewerFile} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Materials" description="Every file from your courses in one place. Click a row to open it." />
      <SearchInput value={search} onChange={setSearch} placeholder="Search files..." />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(file) => file.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No materials yet"
        emptyDescription="Files your tutors add to your courses appear here."
        onRowClick={(file) => setViewerFile(file)}
        rowAriaLabel={(file) => `Open "${file.originalName}"`}
        renderCard={(file) => (
          <div className="flex items-start gap-3">
            <FileTypeIcon mimeType={file.mimeType} fileName={file.originalName} className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-medium text-foreground">{file.originalName}</p>
              <p className="truncate text-xs text-muted-foreground">{file.courseTitle}</p>
              <p className="text-xs text-muted-foreground">
                {fileKindLabel(file.mimeType, file.originalName)} · {formatFileSize(file.sizeBytes)} · {formatDate(file.createdAt)}
              </p>
            </div>
            <div className="shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <StudentFileActions file={file} onView={setViewerFile} />
            </div>
          </div>
        )}
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
