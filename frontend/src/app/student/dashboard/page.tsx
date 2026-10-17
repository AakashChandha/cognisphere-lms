"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap, Megaphone, Play } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { studentsApi } from "@/lib/api/students.api";
import { studentCoursesApi } from "@/lib/api/courses.api";
import { formatRelativeTime } from "@/lib/utils/format";
import { useAuth } from "@/lib/auth/auth-context";
import type { Course } from "@/types/course";

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/**
 * Deliberately only the courses and how far through each one the student is:
 * no file lists and no lesson lists (those live on the course page).
 */
export default function StudentDashboardPage() {
  const { user } = useAuth();

  const coursesQuery = useQuery({
    queryKey: ["student", "courses", "dashboard"],
    queryFn: () => studentCoursesApi.list({ pageSize: 24 }),
  });

  const announcementsQuery = useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: studentsApi.getDashboard,
  });

  const courses = coursesQuery.data?.items ?? [];
  const announcements = announcementsQuery.data?.recentAnnouncements ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hello${user ? `, ${user.firstName}` : ""}`}
        description="Your courses and how far you have got with each one."
      />

      <section className="space-y-4">
        {coursesQuery.isError ? (
          <ErrorState onRetry={() => void coursesQuery.refetch()} />
        ) : coursesQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Your training coordinator will enrol you. Courses appear here as soon as that happens."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <li key={course.id}>
                <CourseProgressCard course={course} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {announcements.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Megaphone className="size-4 text-muted-foreground" />
              Announcements
            </h2>
            <Link href="/student/announcements" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {announcements.slice(0, 3).map((announcement) => (
              <li key={announcement.id}>
                <Link
                  href="/student/announcements"
                  className="block px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <p className="truncate text-sm font-medium text-foreground">{announcement.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatRelativeTime(announcement.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CourseProgressCard({ course }: { course: Course }) {
  const progress = course.progress;
  const total = progress?.totalLessons ?? course.lessonsCount;
  const done = progress?.completedLessons ?? 0;
  const pct = percent(done, total);
  const continueHref = progress?.nextLessonId
    ? `/student/courses/${course.id}/lessons/${progress.nextLessonId}`
    : `/student/courses/${course.id}`;
  const finished = total > 0 && done === total;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md">
      <Link
        href={`/student/courses/${course.id}`}
        aria-label={`Open "${course.title}"`}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-muted"
      >
        {course.thumbnailUrl ? (
          // Covers can be any URL (pasted or uploaded), so no next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailUrl}
            alt=""
            className="size-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        ) : (
          <GraduationCap className="size-10 text-muted-foreground/60" />
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <h2 className="line-clamp-2 font-semibold text-foreground">
            <Link href={`/student/courses/${course.id}`} className="hover:text-primary hover:underline">
              {course.title}
            </Link>
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {course.tutor ? `${course.tutor.firstName} ${course.tutor.lastName}` : "Course material"}
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <Progress value={pct} className="gap-1.5">
            <span className="text-xs text-muted-foreground">{finished ? "Complete" : "Progress"}</span>
            <span className="ml-auto text-xs font-medium tabular-nums text-foreground">{pct}%</span>
          </Progress>

          <Button
            size="sm"
            variant={finished ? "outline" : "default"}
            className="w-full"
            nativeButton={false}
            render={<Link href={continueHref} />}
          >
            <Play className="size-3.5" />
            {finished ? "Review course" : done > 0 ? "Continue" : "Start learning"}
          </Button>
        </div>
      </div>
    </article>
  );
}
