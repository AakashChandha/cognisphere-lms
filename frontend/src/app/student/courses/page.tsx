"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Users, Layers } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseStatusBadge } from "@/components/shared/status-badge";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { studentCoursesApi } from "@/lib/api/courses.api";

export default function StudentCoursesPage() {
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student", "courses", { page, pageSize, search }],
    queryFn: () => studentCoursesApi.list({ page, pageSize, search }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Courses" description="Courses you're currently enrolled in." />

      <SearchInput value={search} onChange={setSearch} placeholder="Search courses..." />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : data!.items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses found"
          description="You are not enrolled in any courses matching this search."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.items.map((course) => (
              <Link key={course.id} href={`/student/courses/${course.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 font-semibold text-foreground">{course.title}</h3>
                      <CourseStatusBadge status={course.status} />
                    </div>
                    <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{course.description}</p>
                    <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                      <span>
                        {course.tutor.firstName} {course.tutor.lastName}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Layers className="size-3.5" /> {course.lessonsCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" /> {course.enrollmentsCount}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <PaginationControls meta={data!.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
    </div>
  );
}
