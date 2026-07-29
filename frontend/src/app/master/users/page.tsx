"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, KeyRound, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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

export default function MasterUsersPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();
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
    onSuccess: () => {
      toast.success("User created successfully");
      close();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to create user"),
  });

  const updateMutation = useMutation({
    mutationFn: (values: UserFormValues & { id: string }) =>
      usersApi.update(values.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        roles: values.roles,
      }),
    onSuccess: () => {
      toast.success("User updated successfully");
      close();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update user"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      usersApi.setActive(payload.id, payload.isActive),
    onSuccess: (_, variables) => {
      toast.success(`User ${variables.isActive ? "enabled" : "disabled"} successfully`);
      close();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update user status"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (payload: { id: string; newPassword: string }) =>
      usersApi.resetPassword(payload.id, payload.newPassword),
    onSuccess: () => {
      toast.success("Password reset successfully");
      close();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to reset password"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toast.success("User deleted successfully");
      close();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to delete user"),
  });

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
      cell: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm">
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
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage every user account in the system."
        actions={
          <Button size="sm" onClick={() => setDialog({ type: "create" })}>
            <Plus className="size-3.5" />
            New user
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search users..." />
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value ?? "ALL")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value={AppRole.MASTER}>Master</SelectItem>
            <SelectItem value={AppRole.TUTOR}>Tutor</SelectItem>
            <SelectItem value={AppRole.STUDENT}>Student</SelectItem>
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
        emptyTitle="No users found"
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
        title={dialog.type === "toggle-active" && dialog.user.isActive ? "Disable this user?" : "Enable this user?"}
        description={
          dialog.type === "toggle-active" && dialog.user.isActive
            ? "They will immediately lose the ability to log in."
            : "They will regain the ability to log in."
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
        title="Delete this user?"
        description="This will permanently remove the user account and all associated data. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (dialog.type === "delete") deleteMutation.mutate(dialog.user.id);
        }}
      />
    </div>
  );
}
