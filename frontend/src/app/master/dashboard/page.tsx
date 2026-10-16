"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  GraduationCap,
  UserCircle,
  BookOpen,
  Layers,
  Megaphone,
  ScrollText,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { masterDashboardApi } from "@/lib/api/dashboard.api";
import { formatRelativeTime, pluralize, toTitleCase } from "@/lib/utils/format";
import { AuditAction } from "@/types/audit-log";

const ACTION_PHRASE: Partial<Record<AuditAction, string>> = {
  [AuditAction.USER_CREATED]: "added a new account",
  [AuditAction.USER_UPDATED]: "updated an account",
  [AuditAction.USER_DELETED]: "deleted an account",
  [AuditAction.USER_ENABLED]: "enabled an account",
  [AuditAction.USER_DISABLED]: "disabled an account",
  [AuditAction.USER_PASSWORD_RESET]: "reset someone's password",
  [AuditAction.AUTH_PASSWORD_CHANGED]: "changed their password",
  [AuditAction.COURSE_CREATED]: "created a course",
  [AuditAction.COURSE_UPDATED]: "updated a course",
  [AuditAction.COURSE_DELETED]: "deleted a course",
  [AuditAction.COURSE_PUBLISHED]: "published a course",
  [AuditAction.COURSE_ARCHIVED]: "archived a course",
  [AuditAction.LESSON_CREATED]: "added a lesson",
  [AuditAction.LESSON_UPDATED]: "updated a lesson",
  [AuditAction.LESSON_DELETED]: "deleted a lesson",
  [AuditAction.FILE_UPLOADED]: "uploaded course material",
  [AuditAction.FILE_DELETED]: "deleted course material",
  [AuditAction.ANNOUNCEMENT_CREATED]: "posted an announcement",
  [AuditAction.ANNOUNCEMENT_UPDATED]: "edited an announcement",
  [AuditAction.ANNOUNCEMENT_DELETED]: "deleted an announcement",
  [AuditAction.ENROLLMENT_CREATED]: "enrolled a student",
  [AuditAction.ENROLLMENT_REMOVED]: "removed a student from a course",
};

function describeAction(action: AuditAction): string {
  return ACTION_PHRASE[action] ?? toTitleCase(action).toLowerCase();
}

function LinkedStat({
  href,
  label,
  value,
  icon,
  accent,
}: {
  href: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <Link href={href} aria-label={`${label}: ${value}. Open list`} className="block rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <StatCard label={label} value={value} icon={icon} accent={accent} className="h-full hover:shadow-md" />
    </Link>
  );
}

export default function MasterDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["master", "dashboard"],
    queryFn: masterDashboardApi.get,
  });

  const v = (n: number | undefined) => (isLoading || n === undefined ? "-" : n);

  return (
    <div className="space-y-6">
      <PageHeader title="Welcome back" description="A quick picture of people, courses and recent activity." />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          {!isLoading && data && data.unassignedCourses > 0 ? (
            <Alert className="border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="text-amber-600 dark:text-amber-400" />
              <AlertTitle>
                {pluralize(data.unassignedCourses, "course")} {data.unassignedCourses === 1 ? "has" : "have"} no tutor
              </AlertTitle>
              <AlertDescription>
                <span>
                  Their tutor left. Students keep access, but nobody can edit them until you assign a new tutor.{" "}
                  <Link href="/master/courses?unassigned=true" className="font-medium text-primary hover:underline">
                    Assign a tutor
                  </Link>
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">People</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <LinkedStat href="/master/users" label="All accounts" value={v(data?.totalUsers)} icon={Users} />
              <LinkedStat href="/master/tutors" label="Tutors" value={v(data?.totalTutors)} icon={GraduationCap} />
              <LinkedStat href="/master/students" label="Students" value={v(data?.totalStudents)} icon={UserCircle} />
              <LinkedStat href="/master/users" label="Disabled accounts" value={v(data?.disabledUsers)} icon={ShieldCheck} accent={data && data.disabledUsers > 0 ? "danger" : "default"} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Courses</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <LinkedStat href="/master/courses?status=PUBLISHED" label="Published" value={v(data?.publishedCourses)} icon={BookOpen} accent="success" />
              <LinkedStat href="/master/courses?status=DRAFT" label="Drafts" value={v(data?.draftCourses)} icon={BookOpen} accent="warning" />
              <LinkedStat href="/master/courses?status=ARCHIVED" label="Archived" value={v(data?.archivedCourses)} icon={BookOpen} />
              <LinkedStat href="/master/courses" label="Enrolments" value={v(data?.totalEnrollments)} icon={Layers} />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="size-4" />
                  Recent activity
                </CardTitle>
                <Link href="/master/audit-logs" className="text-sm font-medium text-primary hover:underline">
                  Full log
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : data!.recentActivity.length === 0 ? (
                  <EmptyState title="Nothing yet" description="Changes people make show up here." className="border-0 py-8" />
                ) : (
                  <ul className="divide-y divide-border">
                    {data!.recentActivity.map((entry) => (
                      <li key={entry.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                        <p className="text-foreground">
                          <span className="font-medium">{entry.actorName ?? "Someone"}</span>{" "}
                          {describeAction(entry.action)}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { href: "/master/users", label: "Add a person", hint: "Create a student, tutor or administrator", icon: Users },
                  { href: "/master/announcements", label: "Post an announcement", hint: `${v(data?.totalAnnouncements)} posted so far`, icon: Megaphone },
                  { href: "/master/courses", label: "Browse every course", hint: `${v(data?.totalCourses)} courses across all tutors`, icon: BookOpen },
                ].map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.hint}</p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
