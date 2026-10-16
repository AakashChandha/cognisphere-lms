"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Layers, Users, Plus, ArrowRight, AlertCircle, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { tutorsApi } from "@/lib/api/tutors.api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatRelativeTime, pluralize } from "@/lib/utils/format";
import { CourseStatus } from "@/types/course";

export default function TutorDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tutor", "dashboard"],
    queryFn: tutorsApi.getDashboard,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello${user ? `, ${user.firstName}` : ""}`}
        description="Here is what needs you, and what your students have been up to."
        actions={
          <Button nativeButton={false} render={<Link href="/tutor/courses/new" />}>
            <Plus className="size-4" />
            New course
          </Button>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Courses" value={isLoading ? "-" : data!.totalCourses} icon={BookOpen} />
            <StatCard label="Students" value={isLoading ? "-" : data!.totalStudents} icon={Users} accent="success" />
            <StatCard label="Lessons" value={isLoading ? "-" : data!.totalLessons} icon={Layers} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-amber-500" />
                  Needs your attention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                ) : data!.needsAttention.length === 0 ? (
                  <EmptyState
                    title="All caught up"
                    description="Every course is published and has students enrolled."
                    className="border-0 py-8"
                  />
                ) : (
                  data!.needsAttention.map((course) => {
                    const isDraft = course.status === CourseStatus.DRAFT;
                    const href = isDraft
                      ? `/tutor/courses/${course.id}?tab=lessons`
                      : `/tutor/courses/${course.id}?tab=students`;
                    return (
                      <Link
                        key={course.id}
                        href={href}
                        className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/60"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {isDraft ? <BookOpen className="size-4" /> : <UserPlus className="size-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{course.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {isDraft
                              ? course.lessonsCount === 0
                                ? "Draft with no lessons yet"
                                : `Draft · ${pluralize(course.lessonsCount, "lesson")}`
                              : "Published, but nobody is enrolled yet"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-primary">
                          {isDraft ? "Finish and publish" : "Enrol students"}
                        </span>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent enrolments</CardTitle>
                <Link href="/tutor/students" className="text-sm font-medium text-primary hover:underline">
                  All students
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                ) : data!.recentEnrollments.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No enrolments yet"
                    description="Enrol students from a course's Students tab and they will show up here."
                    className="border-0 py-8"
                  />
                ) : (
                  data!.recentEnrollments.map((enrollment, index) => (
                    <Link
                      key={`${enrollment.courseId}-${enrollment.studentName}-${index}`}
                      href={`/tutor/courses/${enrollment.courseId}?tab=students`}
                      className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{enrollment.studentName}</p>
                        <p className="truncate text-xs text-muted-foreground">{enrollment.courseTitle}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(enrollment.enrolledAt)}
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Your courses</CardTitle>
              <Link href="/tutor/courses" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : data!.recentCourses.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No courses yet"
                  description="Create your first course. You can add lessons and material right after."
                  className="border-0 py-8"
                  action={
                    <Button nativeButton={false} render={<Link href="/tutor/courses/new" />}>
                      <Plus className="size-4" />
                      Create a course
                    </Button>
                  }
                />
              ) : (
                data!.recentCourses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/tutor/courses/${course.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{course.title}</p>
                        <CourseStatusBadge status={course.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {pluralize(course.lessonsCount, "lesson")} · {pluralize(course.enrollmentsCount, "student")} ·
                        updated {formatRelativeTime(course.updatedAt)}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
