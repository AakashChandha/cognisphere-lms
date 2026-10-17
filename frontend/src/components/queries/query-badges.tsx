import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { QueryAuthorRole, QueryStatus } from "@/types/query";

/**
 * One vocabulary for everyone — the three statuses the API returns — tinted so
 * the thing you are waiting for reads at a glance: amber while a tutor still
 * owes an answer, blue the moment one arrives, green once the student closes it.
 */
const STATUS_LABEL: Record<QueryStatus, string> = {
  OPEN: "Open",
  ANSWERED: "Answered",
  RESOLVED: "Resolved",
};

const STATUS_TONE: Record<QueryStatus, "warning" | "info" | "success"> = {
  OPEN: "warning",
  ANSWERED: "info",
  RESOLVED: "success",
};

/** What the status means to the person reading it. */
const STATUS_HINT: Record<"student" | "staff", Record<QueryStatus, string>> = {
  student: {
    OPEN: "Waiting for your tutor",
    ANSWERED: "Your tutor has replied",
    RESOLVED: "Closed by you",
  },
  staff: {
    OPEN: "Waiting on a reply from you",
    ANSWERED: "Replied — waiting on the student",
    RESOLVED: "Closed by the student",
  },
};

export function queryStatusLabel(status: QueryStatus): string {
  return STATUS_LABEL[status];
}

export function queryStatusHint(status: QueryStatus, audience: "student" | "staff"): string {
  return STATUS_HINT[audience][status];
}

export function QueryStatusBadge({ status }: { status: QueryStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>;
}

const AUTHOR_ROLE_LABEL: Record<QueryAuthorRole, string> = {
  STUDENT: "Student",
  TUTOR: "Tutor",
  MASTER: "Administrator",
};

export function queryAuthorRoleLabel(role: QueryAuthorRole): string {
  return AUTHOR_ROLE_LABEL[role];
}

/** Who is speaking in a thread, so a staff reply is never mistaken for a peer's. */
export function QueryAuthorRoleBadge({ role, className }: { role: QueryAuthorRole; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal text-muted-foreground", className)}>
      {AUTHOR_ROLE_LABEL[role]}
    </Badge>
  );
}
