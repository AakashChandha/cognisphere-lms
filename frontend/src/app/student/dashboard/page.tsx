"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Megaphone, ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { studentsApi } from "@/lib/api/students.api";
import { formatRelativeTime, pluralize } from "@/lib/utils/format";
import { useAuth } from "@/lib/auth/auth-context";

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: studentsApi.getDashboard,
  });

  const next = data?.continueLearning ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello${user ? `, ${user.firstName}` : ""}`}
        description={next ? "Pick up where you left off." : "Here is what is waiting for you."}
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : next ? (
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <p className="text-sm font-medium text-primary">Continue learning</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{next.courseTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Up next: Lesson {next.lessonNumber} · {next.lessonTitle}
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full max-w-md">
                  <Progress value={percent(next.completedLessons, next.totalLessons)} className="gap-2">
                    <span className="text-xs text-muted-foreground">
                      {next.completedLessons} of {pluralize(next.totalLessons, "lesson")} complete
                    </span>
                  </Progress>
                </div>
                <Button
                  size="lg"
                  nativeButton={false}
                  render={<Link href={`/student/courses/${next.courseId}/lessons/${next.lessonId}`} />}
                >
                  <Play className="size-4" />
                  Continue
                </Button>
              </div>
            </section>
          ) : data && data.recentCourses.length > 0 ? (
            <section className="flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <CheckCircle2 className="size-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-semibold text-foreground">You are up to date</p>
                <p className="text-sm text-muted-foreground">
                  Every lesson in your courses is complete. Revisit any course below whenever you like.
                </p>
              </div>
            </section>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>My courses</CardTitle>
                <Link href="/student/courses" className="text-sm font-medium text-primary hover:underline">
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
                    description="Your training coordinator will enrol you. Courses appear here as soon as that happens."
                    className="border-0 py-8"
                  />
                ) : (
                  data!.recentCourses.map((course) => {
                    const pct = percent(course.completedLessons, course.totalLessons);
                    const href = course.nextLessonId
                      ? `/student/courses/${course.id}/lessons/${course.nextLessonId}`
                      : `/student/courses/${course.id}`;
                    return (
                      <Link
                        key={course.id}
                        href={href}
                        className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-medium text-foreground">{course.title}</p>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{pct}%</span>
                          </div>
                          <Progress value={pct} />
                          <p className="truncate text-xs text-muted-foreground">
                            {course.nextLessonTitle ? `Next: ${course.nextLessonTitle}` : "All lessons complete"} ·{" "}
                            {course.tutorName}
                          </p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Announcements</CardTitle>
                <Link href="/student/announcements" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                ) : data!.recentAnnouncements.length === 0 ? (
                  <EmptyState
                    icon={Megaphone}
                    title="Nothing new"
                    description="Announcements from your tutors appear here."
                    className="border-0 py-8"
                  />
                ) : (
                  data!.recentAnnouncements.map((announcement) => (
                    <Link
                      key={announcement.id}
                      href="/student/announcements"
                      className="block rounded-xl border border-border p-3 transition-colors hover:bg-muted/60"
                    >
                      <p className="text-sm font-medium text-foreground">{announcement.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(announcement.createdAt)}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
