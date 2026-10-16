"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AudienceBadge } from "@/components/shared/status-badge";
import { AnnouncementFormDialog, type AnnouncementFormValues } from "@/components/announcements/announcement-form-dialog";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { announcementsApi } from "@/lib/api/announcements.api";
import { masterCoursesApi } from "@/lib/api/courses.api";
import { formatDateTime } from "@/lib/utils/format";
import type { Announcement } from "@/types/announcement";
import { ApiError } from "@/types/api";

export default function MasterAnnouncementsPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
  const [formState, setFormState] = React.useState<{ open: boolean; announcement: Announcement | null }>({
    open: false,
    announcement: null,
  });
  const [deleteTarget, setDeleteTarget] = React.useState<Announcement | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["announcements", { page, pageSize, search }],
    queryFn: () => announcementsApi.list({ page, pageSize, search }),
  });

  const coursesQuery = useQuery({
    queryKey: ["master", "courses", "all-for-select"],
    queryFn: () => masterCoursesApi.list({ pageSize: 100 }),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["announcements"] });
  }

  const createMutation = useMutation({
    mutationFn: (values: AnnouncementFormValues) => announcementsApi.create(values),
    onSuccess: () => {
      toast.success("Announcement posted");
      setFormState({ open: false, announcement: null });
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to post announcement"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...values }: AnnouncementFormValues & { id: string }) =>
      announcementsApi.update(id, values),
    onSuccess: () => {
      toast.success("Announcement updated");
      setFormState({ open: false, announcement: null });
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update announcement"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.remove(id),
    onSuccess: () => {
      toast.success("Announcement deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete announcement"),
  });

  function handleSubmit(values: AnnouncementFormValues) {
    if (formState.announcement) {
      updateMutation.mutate({ ...values, id: formState.announcement.id });
    } else {
      createMutation.mutate(values);
    }
  }

  const courseOptions = coursesQuery.data?.items.map((c) => ({ id: c.id, title: c.title })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Broadcast system-wide updates or manage announcements from any tutor."
        actions={
          <Button size="sm" onClick={() => setFormState({ open: true, announcement: null })}>
            <Plus className="size-3.5" />
            New announcement
          </Button>
        }
      />
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
                    <div className="flex items-center gap-2">
                      <AudienceBadge audience={announcement.audience} />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit "${announcement.title}"`}
                        onClick={() => setFormState({ open: true, announcement })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete "${announcement.title}"`}
                        onClick={() => setDeleteTarget(announcement)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{announcement.content}</p>
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

      <AnnouncementFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
        announcement={formState.announcement}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
        courses={courseOptions}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : "Delete this announcement?"}
        description="It disappears for everyone who could see it. This cannot be undone."
        confirmLabel="Delete announcement"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
