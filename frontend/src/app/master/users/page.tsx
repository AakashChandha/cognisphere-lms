"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, KeyRound, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ActiveStatusBadge, RoleBadge } from "@/components/shared/status-badge";
import { UserFormDialog, type UserFormValues } from "@/components/master/user-form-dialog";
import { ResetPasswordDialog, type ResetPasswordValues } from "@/components/master/reset-password-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { useAuth } from "@/lib/auth/auth-context";
import { usersApi } from "@/lib/api/users.api";
import { formatDate } from "@/lib/utils/format";
import { AppRole } from "@/types/auth";
import type { ManagedUser } from "@/types/people";
import { ApiError } from "@/types/api";

type DialogState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; user: ManagedUser }
  | { type: "reset-password"; user: ManagedUser }
  | { type: "toggle-active"; user: ManagedUser }
  | { type: "delete"; user: ManagedUser };

const ROLE_ITEMS: Record<string, string> = {
  ALL: "All roles",
  [AppRole.MASTER]: "Administrators",
  [AppRole.TUTOR]: "Tutors",
  [AppRole.STUDENT]: "Students",
};

function MasterUsersContent() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState({
    initialSearch: searchParams.get("search") ?? "",
  });
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");
  const [dialog, setDialog] = React.useState<DialogState>({ type: "none" });

  const queryKey = ["master", "users", { page, pageSize, search, roleFilter }];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      usersApi.list({
        page,
        pageSize,
        search,
        role: roleFilter === "ALL" ? undefined : (roleFilter as AppRole),
      }),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["master", "users"] });
  }
  function close() {
    setDialog({ type: "none" });
  }

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      usersApi.create({
        email: values.email!,
        password: values.password!,
        firstName: values.firstName,
        lastName: values.lastName,
        roles: values.roles,
      }),
    onSuccess: (created) => {
      toast.success(`Account created for ${created.firstName} ${created.lastName}. Share the temporary password with them.`);
      close();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't create the account. Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (values: UserFormValues & { id: string }) =>
      usersApi.update(values.id, {
        firstName: values.firstName,
        lastName: values.lastName,
      }),
    onSuccess: () => {
      toast.success("Changes saved");
      close();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't save the changes. Please try again."),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      usersApi.setActive(payload.id, payload.isActive),
    onSuccess: (_, variables) => {
      toast.success(variables.isActive ? "Account enabled. They can sign in again." : "Account disabled. They can no longer sign in.");
      close();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't change the account status."),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (payload: { id: string; newPassword: string }) =>
      usersApi.resetPassword(payload.id, payload.newPassword),
    onSuccess: () => {
      toast.success("Password reset. Share the temporary password with them privately.");
      close();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't reset the password."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toast.success("Account deleted");
      close();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't delete the account."),
  });

  function renderActions(u: ManagedUser) {
    const isSelf = u.id === currentUser?.id;
    return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.firstName} ${u.lastName}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialog({ type: "edit", user: u })}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog({ type: "reset-password", user: u })}>
                <KeyRound /> Reset password
              </DropdownMenuItem>
              {isSelf ? (
                <DropdownMenuItem disabled>
                  <Ban /> You can&apos;t disable your own account
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setDialog({ type: "toggle-active", user: u })}>
                    {u.isActive ? (
                      <>
                        <Ban /> Disable
                      </>
                    ) : (
                      <>
                        <CheckCircle2 /> Enable
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDialog({ type: "delete", user: u })}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
    );
  }

  const columns: DataTableColumn<ManagedUser>[] = [
    {
      id: "name",
      header: "Name",
      cell: (u) => (
        <div>
          <p className="font-medium text-foreground">
            {u.firstName} {u.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{u.email}</p>
        </div>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>
      ),
    },
    { id: "status", header: "Status", cell: (u) => <ActiveStatusBadge isActive={u.isActive} /> },
    { id: "joined", header: "Joined", cell: (u) => formatDate(u.createdAt) },
    {
      id: "actions",
      header: "",
      headerClassName: "w-16",
      stopRowClick: true,
      cell: renderActions,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Every student, tutor and administrator account."
        actions={
          <Button size="sm" onClick={() => setDialog({ type: "create" })}>
            <Plus className="size-3.5" />
            Add person
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email" />
        <Select items={ROLE_ITEMS} value={roleFilter} onValueChange={(value) => setRoleFilter(value ?? "ALL")}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No people found"
        renderCard={(u) => (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="truncate font-medium text-foreground">
                  {u.firstName} {u.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {u.roles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
                <ActiveStatusBadge isActive={u.isActive} />
              </div>
              <p className="text-xs text-muted-foreground">Joined {formatDate(u.createdAt)}</p>
            </div>
            <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              {renderActions(u)}
            </div>
          </div>
        )}
      />

      {data ? <PaginationControls meta={data.meta} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}

      <UserFormDialog
        open={dialog.type === "create" || dialog.type === "edit"}
        onOpenChange={(open) => !open && close()}
        user={dialog.type === "edit" ? dialog.user : null}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={(values) => {
          if (dialog.type === "edit") {
            updateMutation.mutate({ ...values, id: dialog.user.id });
          } else {
            createMutation.mutate(values);
          }
        }}
      />

      <ResetPasswordDialog
        open={dialog.type === "reset-password"}
        onOpenChange={(open) => !open && close()}
        userName={dialog.type === "reset-password" ? `${dialog.user.firstName} ${dialog.user.lastName}` : undefined}
        isSubmitting={resetPasswordMutation.isPending}
        onSubmit={(values: ResetPasswordValues) => {
          if (dialog.type === "reset-password") {
            resetPasswordMutation.mutate({ id: dialog.user.id, newPassword: values.newPassword });
          }
        }}
      />

      <ConfirmDialog
        open={dialog.type === "toggle-active"}
        onOpenChange={(open) => !open && close()}
        title={
          dialog.type === "toggle-active"
            ? `${dialog.user.isActive ? "Disable" : "Enable"} ${dialog.user.firstName} ${dialog.user.lastName}?`
            : "Change account status?"
        }
        description={
          dialog.type === "toggle-active" && dialog.user.isActive
            ? "They are signed out and can no longer sign in. Their courses, enrolments and files are kept, and you can enable them again at any time."
            : "They will be able to sign in again."
        }
        confirmLabel={dialog.type === "toggle-active" && dialog.user.isActive ? "Disable" : "Enable"}
        destructive={dialog.type === "toggle-active" && dialog.user.isActive}
        isLoading={toggleActiveMutation.isPending}
        onConfirm={() => {
          if (dialog.type === "toggle-active") {
            toggleActiveMutation.mutate({ id: dialog.user.id, isActive: !dialog.user.isActive });
          }
        }}
      />

      <ConfirmDialog
        open={dialog.type === "delete"}
        onOpenChange={(open) => !open && close()}
        title={dialog.type === "delete" ? `Delete ${dialog.user.firstName} ${dialog.user.lastName}?` : "Delete this account?"}
        description={
          dialog.type === "delete" && dialog.user.roles.includes(AppRole.TUTOR)
            ? "This permanently removes their account. Courses they created stay in the system and become unassigned until you hand them to another tutor. If they may come back, disable the account instead."
            : dialog.type === "delete" && dialog.user.roles.includes(AppRole.STUDENT)
              ? "This permanently removes their account, enrolments and progress. If they may come back, disable the account instead."
              : "This permanently removes the account. If they may come back, disable the account instead."
        }
        confirmLabel="Delete permanently"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (dialog.type === "delete") deleteMutation.mutate(dialog.user.id);
        }}
      />
    </div>
  );
}

// Suspense boundary required because the page reads filters via useSearchParams().
export default function MasterUsersPage() {
  return (
    <React.Suspense fallback={<FullPageSpinner label="Loading users..." />}>
      <MasterUsersContent />
    </React.Suspense>
  );
}
