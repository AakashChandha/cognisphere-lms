import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

// Tones come from semantic tokens (globals.css), so a badge is legible in
// both themes without a per-theme override at the call site.
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-info/25 bg-info/10 text-info",
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
