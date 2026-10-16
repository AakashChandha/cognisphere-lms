"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Layers } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { pluralize } from "@/lib/utils/format";
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
      <PageHeader title="My courses" description="Pick a course to continue learning." />

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
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3">
                    <h3 className="line-clamp-2 font-semibold text-foreground">{course.title}</h3>
                    <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{course.description}</p>
                    {course.progress && course.progress.totalLessons > 0 ? (
                      <Progress
                        value={Math.round((course.progress.completedLessons / course.progress.totalLessons) * 100)}
                        className="gap-1.5"
                      >
                        <span className="text-xs text-muted-foreground">
                          {course.progress.completedLessons} of {pluralize(course.progress.totalLessons, "lesson")}
                          {course.progress.completedLessons === course.progress.totalLessons ? " · complete" : ""}
                        </span>
                      </Progress>
                    ) : null}
                    <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                      <span>{course.tutor ? `${course.tutor.firstName} ${course.tutor.lastName}` : "Course material"}</span>
                      <span className="flex items-center gap-1">
                        <Layers className="size-3.5" /> {pluralize(course.lessonsCount, "lesson")}
                      </span>
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
