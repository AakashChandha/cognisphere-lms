"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  GraduationCap,
  Layers,
  Lock,
  Mail,
  Phone,
} from "lucide-react";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { ActiveStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import {
  AssessmentTypeBadge,
  AttemptStatusBadge,
  formatScore,
} from "@/components/assessments/assessment-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDate, formatRelativeTime, getInitials, pluralize } from "@/lib/utils/format";
import type { StudentProgressCourse, StudentProgressDetail } from "@/types/student-progress";

/** Which role-scoped routes to link out to. MASTER sees the same screen, unscoped. */
export type StaffRole = "tutor" | "master";

/**
 * The staff mirror of the student's own course page: who this student is, how
 * far along they are overall, and then per course — percent complete, which
 * lessons are ticked, when they were last active and how their assessments
 * went. Rendered identically for a tutor (their own courses) and the admin
 * (every course); the role only decides where the links point.
 */
export function StudentProgressView({ detail, role }: { detail: StudentProgressDetail; role: StaffRole }) {
  const { student, totals, courses } = detail;
  const fullName = `${student.firstName} ${student.lastName}`;

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: "Students", href: `/${role}/students` }, { label: fullName }]} />

      <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar size="lg" className="size-12 sm:size-14">
              {student.avatarUrl ? <AvatarImage src={student.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-base">
                {getInitials(student.firstName, student.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-semibold text-balance text-foreground">{fullName}</h1>
                <ActiveStatusBadge isActive={student.isActive} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{student.email}</span>
                </span>
                {student.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    {student.phone}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                  Joined {formatDate(student.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 space-y-2 lg:w-72">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Overall progress</span>
              <span className="font-heading text-xl font-semibold tabular-nums text-foreground">
                {totals.overallPercent}%
              </span>
            </div>
            <Progress value={totals.overallPercent} className="gap-2">
              <span className="text-xs text-muted-foreground">
                {totals.lessonsCompleted} of {pluralize(totals.lessonsTotal, "lesson")} complete across{" "}
                {pluralize(totals.coursesCount, "course")}
              </span>
            </Progress>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Courses"
          value={totals.coursesCount}
          icon={BookOpen}
          description={`${totals.completedCoursesCount} finished`}
        />
        <StatCard
          label="Lessons complete"
          value={`${totals.lessonsCompleted} / ${totals.lessonsTotal}`}
          icon={Layers}
          accent="success"
        />
        <StatCard
          label="Assessments passed"
          value={`${totals.assessmentsPassed} / ${totals.assessmentsTotal}`}
          icon={ClipboardCheck}
          accent={totals.assessmentsPassed === totals.assessmentsTotal ? "success" : "warning"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Courses</h2>
        {courses.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Not enrolled in any course yet"
            description="Once this student is enrolled, their progress through each course shows up here."
          />
        ) : (
          <ul className="space-y-4">
            {courses.map((course) => (
              <li key={course.courseId}>
                <CourseProgressCard course={course} role={role} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CourseProgressCard({ course, role }: { course: StudentProgressCourse; role: StaffRole }) {
  const isComplete = course.totalLessons > 0 && course.completedLessons === course.totalLessons;
  const lessons = React.useMemo(
    () => [...course.lessons].sort((a, b) => a.orderIndex - b.orderIndex),
    [course.lessons],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="hidden size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:flex">
            {course.thumbnailUrl ? (
              // Covers can be any URL (pasted or uploaded), so no next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnailUrl} alt="" className="size-full object-cover" />
            ) : (
              <GraduationCap className="size-6 text-muted-foreground/60" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/${role}/courses/${course.courseId}`}
                className="truncate text-base font-semibold text-foreground hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {course.courseTitle}
              </Link>
              {isComplete ? <StatusBadge tone="success">Complete</StatusBadge> : null}
              {course.progressionMode === "SEQUENTIAL" ? (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  <Lock className="size-3" />
                  In order
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Enrolled {formatDate(course.enrolledAt)} ·{" "}
              {course.lastActivityAt ? `last active ${formatRelativeTime(course.lastActivityAt)}` : "no activity yet"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">{course.percent}%</p>
            <p className="text-xs text-muted-foreground">
              {course.completedLessons} / {course.totalLessons} lessons
            </p>
          </div>
        </div>

        <Progress value={course.percent} aria-label={`${course.courseTitle} progress`} />

        {!isComplete && course.nextLessonTitle ? (
          <p className="truncate text-sm text-muted-foreground">
            Up next: <span className="font-medium text-foreground">{course.nextLessonTitle}</span>
          </p>
        ) : null}
      </div>

      {lessons.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="group press-subtle flex w-full items-center justify-between gap-2 border-t border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-5">
            <span>
              Lessons · {course.completedLessons} of {lessons.length} ticked off
            </span>
            <ChevronDown
              className="size-4 shrink-0 transition-transform duration-(--duration-base) ease-spring group-aria-expanded:rotate-180"
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="divide-y divide-border border-t border-border">
              {lessons.map((lesson, index) => (
                <li key={lesson.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  {lesson.isCompleted ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      lesson.isCompleted ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {index + 1}. {lesson.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {lesson.isCompleted
                      ? lesson.completedAt
                        ? formatDate(lesson.completedAt)
                        : "Done"
                      : "Not done"}
                  </span>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
          This course has no lessons yet.
        </p>
      )}

      {course.assessments.length > 0 ? (
        <div className="space-y-2.5 border-t border-border px-4 py-3 sm:px-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Assessments</p>
          <ul className="space-y-2.5">
            {course.assessments.map((assessment) => (
              <li key={assessment.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{assessment.title}</span>
                  <AssessmentTypeBadge type={assessment.type} />
                  <AttemptStatusBadge status={assessment.status} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Best {formatScore(assessment.bestScorePercent)} · pass {assessment.passPercent}% ·{" "}
                    {pluralize(assessment.attemptsCount, "attempt")}
                  </span>
                  {assessment.latestAttemptId ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      nativeButton={false}
                      render={<Link href={`/${role}/attempts/${assessment.latestAttemptId}`} />}
                    >
                      {assessment.status === "SUBMITTED" ? "Review" : "View"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
