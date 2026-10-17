"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Library } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FileViewerDialog } from "@/components/shared/file-viewer-dialog";
import { FileTypeIcon, fileKindLabel } from "@/components/shared/file-type-icon";
import { StudentFileActions } from "@/components/shared/student-file-actions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { studentStudyMaterialsApi, studyMaterialToPreviewFile } from "@/lib/api/study-materials.api";
import { formatFileSize } from "@/lib/utils/format";
import type { StudyMaterial } from "@/types/study-material";

export default function StudentMaterialsPage() {
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState({ initialPageSize: 12 });
  const [viewerMaterial, setViewerMaterial] = React.useState<StudyMaterial | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "study-materials", { page, pageSize, search }],
    queryFn: () => studentStudyMaterialsApi.list({ page, pageSize, search }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Reference material your tutors have shared with your courses. Open anything here to read it in the app."
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search materials..." />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : data!.items.length === 0 ? (
        <EmptyState
          icon={Library}
          title={search ? "Nothing matches that search" : "No materials yet"}
          description={
            search
              ? "Try a different word, or clear the search to see everything shared with you."
              : "Books and reference files your tutors share with your courses appear here."
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.items.map((material) => (
              <li
                key={material.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <FileTypeIcon
                    mimeType={material.mimeType}
                    fileName={material.originalName}
                    className="mt-0.5 size-5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-sm font-semibold text-foreground">{material.title}</h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{material.courseTitle}</p>
                  </div>
                </div>

                {material.description ? (
                  <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{material.description}</p>
                ) : (
                  <div className="flex-1" />
                )}

                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <Badge variant="outline" className="font-normal">
                    {fileKindLabel(material.mimeType, material.originalName)} · {formatFileSize(material.sizeBytes)}
                  </Badge>
                  <StudentFileActions file={material} onView={setViewerMaterial} label={material.title} />
                </div>
              </li>
            ))}
          </ul>
          <PaginationControls meta={data!.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}

      <FileViewerDialog
        file={viewerMaterial ? studyMaterialToPreviewFile(viewerMaterial, "student") : null}
        label={viewerMaterial?.title}
        open={!!viewerMaterial}
        onOpenChange={(open) => !open && setViewerMaterial(null)}
      />
    </div>
  );
}
