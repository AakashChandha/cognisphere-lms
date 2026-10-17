import { FileText, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type {
  AssessmentStatus,
  AssessmentType,
  AttemptStatus,
  StudentAssessmentStatus,
} from "@/types/assessment";

const ATTEMPT_LABELS: Record<AttemptStatus, string> = {
  IN_PROGRESS: "In progress",
  SUBMITTED: "Awaiting review",
  PASSED: "Passed",
  FAILED: "Not passed",
};

export function assessmentTypeLabel(type: AssessmentType): string {
  return type === "MCQ" ? "Multiple choice" : "Question paper";
}

export function attemptStatusLabel(status: StudentAssessmentStatus): string {
  return status === "NOT_STARTED" ? "Not started" : ATTEMPT_LABELS[status];
}

export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  return (
    <StatusBadge tone={status === "PUBLISHED" ? "success" : "neutral"}>
      {status === "PUBLISHED" ? "Published" : "Draft"}
    </StatusBadge>
  );
}

export function AttemptStatusBadge({ status }: { status: StudentAssessmentStatus }) {
  const tone =
    status === "PASSED"
      ? "success"
      : status === "FAILED"
        ? "danger"
        : status === "SUBMITTED"
          ? "warning"
          : status === "IN_PROGRESS"
            ? "info"
            : "neutral";
  return <StatusBadge tone={tone}>{attemptStatusLabel(status)}</StatusBadge>;
}

export function AssessmentTypeBadge({ type, className }: { type: AssessmentType; className?: string }) {
  const Icon = type === "MCQ" ? ListChecks : FileText;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium text-muted-foreground", className)}>
      <Icon className="size-3" />
      {assessmentTypeLabel(type)}
    </Badge>
  );
}

/** "72%" or an em dash: a null score is "never graded", not zero. */
export function formatScore(scorePercent: number | null): string {
  return scorePercent === null ? "—" : `${scorePercent}%`;
}
