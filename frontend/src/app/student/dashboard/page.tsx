"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Megaphone, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { studentsApi } from "@/lib/api/students.api";
import { formatRelativeTime, toTitleCase } from "@/lib/utils/format";
import { useAuth } from "@/lib/auth/auth-context";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: studentsApi.getDashboard,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user ? `, ${user.firstName}` : ""}`}
        description="Here's what's happening with your courses."
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Enrolled Courses"
              value={isLoading ? "-" : data!.enrolledCoursesCount}
              icon={BookOpen}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent Courses</CardTitle>
                <Link href="/student/courses" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                ) : data!.recentCourses.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No enrolled courses yet"
                    description="Once you're enrolled in a course, it will appear here."
                    className="border-0 py-8"
                  />
                ) : (
                  data!.recentCourses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/student/courses/${course.id}`}
                      className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{course.title}</p>
                        <Badge variant="outline" className="mt-1">
                          {toTitleCase(course.status)}
                        </Badge>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent Announcements</CardTitle>
                <Link href="/student/announcements" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                ) : data!.recentAnnouncements.length === 0 ? (
                  <EmptyState
                    icon={Megaphone}
                    title="No announcements yet"
                    className="border-0 py-8"
                  />
                ) : (
                  data!.recentAnnouncements.map((announcement) => (
                    <div key={announcement.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-foreground">{announcement.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatRelativeTime(announcement.createdAt)}
                      </p>
                    </div>
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
