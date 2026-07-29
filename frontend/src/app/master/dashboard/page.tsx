"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, UserCircle, BookOpen, Layers, Megaphone, ScrollText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { masterDashboardApi } from "@/lib/api/dashboard.api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateTime, toTitleCase } from "@/lib/utils/format";

export default function MasterDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["master", "dashboard"],
    queryFn: masterDashboardApi.get,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user ? `, ${user.firstName}` : ""}`}
        description="System-wide overview of users, courses and activity."
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Users" value={isLoading ? "-" : data!.totalUsers} icon={Users} />
            <StatCard
              label="Active Users"
              value={isLoading ? "-" : data!.activeUsers}
              icon={ShieldCheck}
              accent="success"
            />
            <StatCard
              label="Disabled Users"
              value={isLoading ? "-" : data!.disabledUsers}
              icon={ShieldCheck}
              accent="danger"
            />
            <StatCard label="Total Tutors" value={isLoading ? "-" : data!.totalTutors} icon={GraduationCap} />
            <StatCard label="Total Students" value={isLoading ? "-" : data!.totalStudents} icon={UserCircle} />
            <StatCard label="Total Courses" value={isLoading ? "-" : data!.totalCourses} icon={BookOpen} />
            <StatCard
              label="Published Courses"
              value={isLoading ? "-" : data!.publishedCourses}
              icon={BookOpen}
              accent="success"
            />
            <StatCard
              label="Draft Courses"
              value={isLoading ? "-" : data!.draftCourses}
              icon={BookOpen}
              accent="warning"
            />
            <StatCard label="Archived Courses" value={isLoading ? "-" : data!.archivedCourses} icon={BookOpen} />
            <StatCard label="Total Enrollments" value={isLoading ? "-" : data!.totalEnrollments} icon={Layers} />
            <StatCard label="Announcements" value={isLoading ? "-" : data!.totalAnnouncements} icon={Megaphone} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="size-4" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : data!.recentActivity.length === 0 ? (
                <EmptyState title="No recent activity" />
              ) : (
                <div className="divide-y divide-border">
                  {data!.recentActivity.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="text-foreground">
                        {toTitleCase(entry.action)} <span className="text-muted-foreground">· {entry.entityType}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
