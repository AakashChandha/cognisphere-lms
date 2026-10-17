"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap, Layers, Lock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { pluralize } from "@/lib/utils/format";
import { usePaginationState } from "@/hooks/use-pagination-state";
import { studentCoursesApi } from "@/lib/api/courses.api";

export default function StudentCoursesPage() {
  const { page, pageSize, search, setPage, setPageSize, setSearch } = usePaginationState({ initialPageSize: 12 });

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
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
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
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.items.map((course) => {
              const progress = course.progress;
              const total = progress?.totalLessons ?? course.lessonsCount;
              const done = progress?.completedLessons ?? 0;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              return (
                <li key={course.id}>
                  <Link
                    href={`/student/courses/${course.id}`}
                    className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-muted">
                      {course.thumbnailUrl ? (
                        // Covers can be any URL (pasted or uploaded), so no next/image.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={course.thumbnailUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <GraduationCap className="size-10 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="space-y-1">
                        <h2 className="line-clamp-2 font-semibold text-foreground">{course.title}</h2>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                      </div>
                      {total > 0 ? (
                        <Progress value={pct} className="mt-auto gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {done} of {pluralize(total, "lesson")}
                          </span>
                          <span className="ml-auto text-xs font-medium tabular-nums text-foreground">{pct}%</span>
                        </Progress>
                      ) : (
                        <div className="mt-auto" />
                      )}
                      <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                        <span className="truncate">
                          {course.tutor ? `${course.tutor.firstName} ${course.tutor.lastName}` : "Course material"}
                        </span>
                        {course.progressionMode === "SEQUENTIAL" ? (
                          <Badge variant="outline" className="shrink-0 font-normal">
                            <Lock className="size-3" />
                            In order
                          </Badge>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1">
                            <Layers className="size-3.5" /> {pluralize(course.lessonsCount, "lesson")}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <PaginationControls meta={data!.meta} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
    </div>
  );
}
