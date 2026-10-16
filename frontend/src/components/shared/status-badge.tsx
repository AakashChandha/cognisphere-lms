import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
};

const COURSE_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
  DEACTIVATED: "danger",
};

const ACTIVE_STATUS_TONE: Record<string, StatusTone> = {
  true: "success",
  false: "danger",
};

const AUDIENCE_TONE: Record<string, StatusTone> = {
  ALL: "info",
  STUDENTS: "success",
  TUTORS: "warning",
};

function toTitleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASSES[tone])}>
      {children}
    </Badge>
  );
}

export function CourseStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={COURSE_STATUS_TONE[status] ?? "neutral"}>{toTitleCase(status)}</StatusBadge>;
}

export function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <StatusBadge tone={ACTIVE_STATUS_TONE[String(isActive)]}>{isActive ? "Active" : "Disabled"}</StatusBadge>
  );
}

export function AudienceBadge({ audience }: { audience: string }) {
  return <StatusBadge tone={AUDIENCE_TONE[audience] ?? "neutral"}>{toTitleCase(audience)}</StatusBadge>;
}

export function RoleBadge({ role }: { role: string }) {
  return <StatusBadge tone="info">{toTitleCase(role)}</StatusBadge>;
}
