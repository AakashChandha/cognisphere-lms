"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Library, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileViewerDialog } from "@/components/shared/file-viewer-dialog";
import { FileTypeIcon, fileKindLabel } from "@/components/shared/file-type-icon";
import {
  StudyMaterialFormDialog,
  type CourseOption,
  type StudyMaterialFormValues,
} from "@/components/materials/study-material-form-dialog";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { studyMaterialsApi, studyMaterialToPreviewFile } from "@/lib/api/study-materials.api";
import { masterCoursesApi, tutorCoursesApi } from "@/lib/api/courses.api";
import { formatDate, formatFileSize } from "@/lib/utils/format";
import type { StudyMaterial, StudyMaterialManagerRole } from "@/types/study-material";
import { ApiError } from "@/types/api";

const ALL_COURSES = "all";

interface StudyMaterialsManagerProps {
  role: StudyMaterialManagerRole;
}

/**
 * Upload / manage side of the Materials tab. Mounted for both tutors (their own
 * courses) and admins (every course); the only difference is which endpoints
 * and which course list are used.
 */
export function StudyMaterialsManager({ role }: StudyMaterialsManagerProps) {
  const api = React.useMemo(() => studyMaterialsApi(role), [role]);
  const queryClient = useQueryClient();
  const queryRoot = [role, "study-materials"] as const;
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [courseFilter, setCourseFilter] = React.useState<string>(ALL_COURSES);
  const [formState, setFormState] = React.useState<{ open: boolean; material: StudyMaterial | null }>({
    open: false,
    material: null,
  });
  const [deleteTarget, setDeleteTarget] = React.useState<StudyMaterial | null>(null);
  const [viewerMaterial, setViewerMaterial] = React.useState<StudyMaterial | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const coursesQuery = useQuery({
    queryKey: [role, "courses", "for-materials"],
    queryFn: () =>
      role === "master"
        ? masterCoursesApi.list({ pageSize: 100 })
        : tutorCoursesApi.list({ pageSize: 100 }),
  });

  const courses: CourseOption[] = React.useMemo(
    () => (coursesQuery.data?.items ?? []).map((course) => ({ id: course.id, title: course.title })),
    [coursesQuery.data],
  );

  const courseFilterItems = React.useMemo(() => {
    const items: Record<string, string> = { [ALL_COURSES]: "All courses" };
    for (const course of courses) items[course.id] = course.title;
    return items;
  }, [courses]);

  const listQuery = useQuery({
    queryKey: [...queryRoot, { page, pageSize, search, courseFilter }],
    queryFn: () =>
      api.list({
        page,
        pageSize,
        search,
        courseId: courseFilter === ALL_COURSES ? undefined : courseFilter,
      }),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryRoot });
  }

  const uploadMutation = useMutation({
    mutationFn: (payload: { values: StudyMaterialFormValues; file: File }) =>
      api.upload(
        payload.values.courseId,
        {
          file: payload.file,
          title: payload.values.title,
          description: payload.values.description || undefined,
        },
        setUploadProgress,
      ),
    onSuccess: (material) => {
      toast.success(`"${material.title}" added`);
      setFormState({ open: false, material: null });
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "The upload failed. Check your connection and try again."),
    onSettled: () => setUploadProgress(0),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; values: StudyMaterialFormValues }) =>
      api.update(payload.id, {
        title: payload.values.title,
        description: payload.values.description,
        courseId: payload.values.courseId,
      }),
    onSuccess: (material) => {
      toast.success(`"${material.title}" saved`);
      setFormState({ open: false, material: null });
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't save the changes. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => {
      toast.success(deleteTarget ? `"${deleteTarget.title}" deleted` : "Material deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete the material. Please try again."),
  });

  const isSubmitting = uploadMutation.isPending || updateMutation.isPending;

  function handleSubmit(values: StudyMaterialFormValues, file: File | null) {
    if (formState.material) {
      updateMutation.mutate({ id: formState.material.id, values });
    } else if (file) {
      uploadMutation.mutate({ values, file });
    }
  }

  const columns: DataTableColumn<StudyMaterial>[] = [
    {
      id: "title",
      header: "Material",
      cell: (material) => (
        <div className="flex items-start gap-2">
          <FileTypeIcon
            mimeType={material.mimeType}
            fileName={material.originalName}
            className="mt-0.5 size-4 shrink-0"
          />
          <div className="min-w-0">
            <p className="max-w-64 truncate font-medium text-foreground">{material.title}</p>
            {material.description ? (
              <p className="max-w-64 truncate text-xs text-muted-foreground">{material.description}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    { id: "course", header: "Course", cell: (material) => material.courseTitle },
    { id: "kind", header: "Type", cell: (material) => fileKindLabel(material.mimeType, material.originalName) },
    { id: "size", header: "Size", cell: (material) => formatFileSize(material.sizeBytes) },
    { id: "added", header: "Added", cell: (material) => formatDate(material.createdAt) },
    {
      id: "actions",
      header: "",
      headerClassName: "w-32",
      stopRowClick: true,
      cell: (material) => (
        <div className="flex items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setViewerMaterial(material)}
            aria-label={`Open "${material.title}"`}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setFormState({ open: true, material })}
            aria-label={`Edit "${material.title}"`}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setDeleteTarget(material)}
            aria-label={`Delete "${material.title}"`}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Reference files for a course — books, standards, handouts. Students read them in the browser and cannot download them."
        actions={
          <Button onClick={() => setFormState({ open: true, material: null })}>
            <Plus className="size-4" />
            Add material
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchInput value={search} onChange={setSearch} placeholder="Search materials..." />
        <div className="space-y-1.5">
          <Label htmlFor="materials-course-filter" className="text-xs text-muted-foreground">
            Course
          </Label>
          <Select
            items={courseFilterItems}
            value={courseFilter}
            onValueChange={(value) => {
              setCourseFilter(value ?? ALL_COURSES);
              setPage(1);
            }}
          >
            <SelectTrigger id="materials-course-filter" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COURSES}>All courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.items ?? []}
        rowKey={(material) => material.id}
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        onRetry={() => void listQuery.refetch()}
        emptyTitle="No study materials yet"
        emptyDescription="Add a reference file and pick the course it belongs to. Enrolled students see it in their Materials tab."
        onRowClick={(material) => setViewerMaterial(material)}
        rowAriaLabel={(material) => `Open "${material.title}"`}
        renderCard={(material) => (
          <div className="flex items-start gap-3">
            <FileTypeIcon
              mimeType={material.mimeType}
              fileName={material.originalName}
              className="mt-0.5 size-5 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-medium text-foreground">{material.title}</p>
              {material.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{material.description}</p>
              ) : null}
              <p className="truncate text-xs text-muted-foreground">{material.courseTitle}</p>
              <p className="text-xs text-muted-foreground">
                {fileKindLabel(material.mimeType, material.originalName)} · {formatFileSize(material.sizeBytes)} ·{" "}
                {formatDate(material.createdAt)}
              </p>
            </div>
            <div
              className="flex shrink-0 flex-col gap-0.5"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setFormState({ open: true, material })}
                aria-label={`Edit "${material.title}"`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setDeleteTarget(material)}
                aria-label={`Delete "${material.title}"`}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        )}
      />

      {listQuery.data ? (
        <PaginationControls meta={listQuery.data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
      ) : null}

      {courses.length === 0 && !coursesQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Library className="size-4" />
          {role === "master"
            ? "There are no courses yet, so there is nothing to attach material to."
            : "You have no courses yet. Create one first, then add its reference material here."}
        </p>
      ) : null}

      <StudyMaterialFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
        material={formState.material}
        courses={courses}
        coursesLoading={coursesQuery.isLoading}
        isSubmitting={isSubmitting}
        uploadProgress={uploadProgress}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : "Delete this material?"}
        description="Students lose access immediately and the file cannot be recovered."
        confirmLabel="Delete material"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />

      <FileViewerDialog
        file={viewerMaterial ? studyMaterialToPreviewFile(viewerMaterial, role) : null}
        label={viewerMaterial?.title}
        open={!!viewerMaterial}
        onOpenChange={(open) => !open && setViewerMaterial(null)}
      />
    </div>
  );
}
