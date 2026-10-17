"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Lock, MessagesSquare } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { QueryMessageList } from "@/components/queries/query-message-list";
import { QueryReplyBox } from "@/components/queries/query-reply-box";
import { QueryStatusBadge, queryStatusHint } from "@/components/queries/query-badges";
import { staffQueriesApiFor, studentQueriesApi } from "@/lib/api/queries.api";
import { formatDateTime, pluralize } from "@/lib/utils/format";
import { ApiError } from "@/types/api";
import type { QueryDetail, QueryViewerRole } from "@/types/query";

/**
 * One conversation, shown to whoever opened it. The student and staff screens
 * are the same thread with different affordances: only the student is offered
 * "Mark as resolved", and only while the thread is still open.
 */
export function QueryThreadView({ role, queryId }: { role: QueryViewerRole; queryId: string }) {
  const isStudent = role === "student";
  const queryClient = useQueryClient();
  const [confirmResolve, setConfirmResolve] = React.useState(false);

  const api = React.useMemo(
    () => (isStudent ? studentQueriesApi : staffQueriesApiFor(role === "master" ? "master" : "tutor")),
    [isStudent, role],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [role, "queries", queryId],
    queryFn: () => api.getById(queryId),
  });

  /** The thread we just got back is authoritative; the lists behind it are now stale. */
  function applyUpdated(updated: QueryDetail) {
    queryClient.setQueryData([role, "queries", queryId], updated);
    void queryClient.invalidateQueries({ queryKey: [role, "queries"] });
  }

  const replyMutation = useMutation({
    mutationFn: (body: string) => api.reply(queryId, { body }),
    onSuccess: (updated) => {
      applyUpdated(updated);
      toast.success(isStudent ? "Message sent to your tutor." : "Reply sent to the student.");
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError && err.status === 409
          ? "This question has been resolved, so it can no longer be replied to."
          : err instanceof ApiError
            ? err.message
            : "Couldn't send your message. Please try again.",
      ),
  });

  const resolveMutation = useMutation({
    mutationFn: () => studentQueriesApi.resolve(queryId),
    onSuccess: (updated) => {
      applyUpdated(updated);
      setConfirmResolve(false);
      toast.success("Marked as resolved.");
    },
    onError: (err) => {
      setConfirmResolve(false);
      toast.error(
        err instanceof ApiError && err.status === 409
          ? "This question was already resolved."
          : err instanceof ApiError
            ? err.message
            : "Couldn't mark this as resolved. Please try again.",
      );
    },
  });

  const breadcrumbRoot = isStudent
    ? { label: "Queries", href: "/student/queries" }
    : { label: "Queries", href: `/${role}/queries` };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageBreadcrumb items={[breadcrumbRoot, { label: "Question" }]} />
        <ErrorState
          title="Couldn't open this question"
          description={
            error instanceof ApiError && error.status === 404
              ? isStudent
                ? "This question is no longer available. It may have been removed."
                : "This question is not available to you. It may belong to another tutor's course, or it may have been removed."
              : "Something went wrong loading the conversation. Please try again."
          }
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const coursePath = `/${role}/courses/${data.courseId}`;
  const canResolve = isStudent && data.canResolve;

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[breadcrumbRoot, { label: data.title }]} />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <QueryStatusBadge status={data.status} />
            <span className="text-xs text-muted-foreground">
              {queryStatusHint(data.status, isStudent ? "student" : "staff")}
            </span>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-balance text-foreground">{data.title}</h1>
          <p className="text-sm text-muted-foreground">
            {isStudent ? null : (
              <>
                <span className="font-medium text-foreground">{data.studentName}</span>
                {" · "}
              </>
            )}
            <Link href={coursePath} className="underline-offset-4 hover:underline">
              {data.courseTitle}
            </Link>
            {data.lessonTitle ? ` · ${data.lessonTitle}` : " · Whole course"}
          </p>
          <p className="text-xs text-muted-foreground">
            Asked {formatDateTime(data.createdAt)} · {pluralize(data.messageCount, "message")}
            {data.resolvedAt ? ` · Resolved ${formatDateTime(data.resolvedAt)}` : ""}
          </p>
        </div>

        {canResolve ? (
          <Button variant="outline" onClick={() => setConfirmResolve(true)}>
            <CheckCircle2 className="size-4" />
            Mark as resolved
          </Button>
        ) : null}
      </header>

      <section aria-label="Conversation">
        {data.messages.length === 0 ? (
          <Alert>
            <MessagesSquare className="size-4" />
            <AlertTitle>No messages yet</AlertTitle>
            <AlertDescription>This thread has no messages.</AlertDescription>
          </Alert>
        ) : (
          <QueryMessageList messages={data.messages} />
        )}
      </section>

      {data.canReply ? (
        <QueryReplyBox
          onSubmit={async (body) => {
            await replyMutation.mutateAsync(body);
          }}
          isSubmitting={replyMutation.isPending}
          label={isStudent ? "Add to the conversation" : "Your reply"}
          placeholder={
            isStudent
              ? "Add more detail, or reply to your tutor..."
              : "Answer the student's question. They will see this straight away."
          }
          submitLabel={isStudent ? "Send message" : "Send reply"}
        />
      ) : (
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>This question is resolved</AlertTitle>
          <AlertDescription>
            {isStudent
              ? "Resolved questions are closed for good. If you still need help, ask a new question from your Queries page."
              : "The student closed this thread, so it can no longer be replied to. They will raise a new question if they need more help."}
          </AlertDescription>
        </Alert>
      )}

      {isStudent ? (
        <ConfirmDialog
          open={confirmResolve}
          onOpenChange={setConfirmResolve}
          title="Mark this question as resolved?"
          description="This closes the thread for good — neither you nor your tutor can add to it afterwards. If you need more help later, ask a new question."
          confirmLabel="Mark as resolved"
          isLoading={resolveMutation.isPending}
          onConfirm={() => resolveMutation.mutate()}
        />
      ) : null}
    </div>
  );
}
