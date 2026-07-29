"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, Layers, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { tutorsApi } from "@/lib/api/tutors.api";
import { useAuth } from "@/lib/auth/auth-context";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function TutorDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tutor", "dashboard"],
    queryFn: tutorsApi.getDashboard,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user ? `, ${user.firstName}` : ""}`}
        description="Here's an overview of your courses and students."
        actions={
          <Button nativeButton={false} render={<Link href="/tutor/courses/new" />}>
            <Plus className="size-4" />
            New Course
          </Button>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Courses" value={isLoading ? "-" : data!.totalCourses} icon={BookOpen} />
          <StatCard
            label="Published"
            value={isLoading ? "-" : data!.publishedCourses}
            icon={BookOpen}
            accent="success"
          />
          <StatCard
            label="Drafts"
            value={isLoading ? "-" : data!.draftCourses}
            icon={BookOpen}
            accent="warning"
          />
          <StatCard label="Archived" value={isLoading ? "-" : data!.archivedCourses} icon={BookOpen} />
          <StatCard label="Total Students" value={isLoading ? "-" : data!.totalStudents} icon={Users} />
          <StatCard label="Total Lessons" value={isLoading ? "-" : data!.totalLessons} icon={Layers} />
          <StatCard label="Total Files" value={isLoading ? "-" : data!.totalFiles} icon={FileText} />
        </div>
      )}
    </div>
  );
}
