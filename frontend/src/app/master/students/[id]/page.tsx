"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ErrorState } from "@/components/shared/error-state";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { StudentProgressView } from "@/components/students/student-progress-view";
import { studentsApi } from "@/lib/api/students.api";
import { ApiError } from "@/types/api";

/** How far one student has got, across every course. Same screen the tutor sees. */
export default function MasterStudentProgressPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["master", "students", studentId],
    queryFn: () => studentsApi.getForMaster(studentId),
  });

  if (isLoading) return <FullPageSpinner label="Loading progress..." />;

  if (isError || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        title={notFound ? "Student not found" : "Couldn't load this student"}
        description={
          notFound
            ? "That student account no longer exists."
            : "Their progress didn't load. Check your connection and try again."
        }
        onRetry={notFound ? undefined : () => void refetch()}
      />
    );
  }

  return <StudentProgressView detail={data} role="master" />;
}
