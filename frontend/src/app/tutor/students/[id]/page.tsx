"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ErrorState } from "@/components/shared/error-state";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { StudentProgressView } from "@/components/students/student-progress-view";
import { tutorsApi } from "@/lib/api/tutors.api";
import { ApiError } from "@/types/api";

/** How far one of my students has got, across my courses only. */
export default function TutorStudentProgressPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tutor", "students", studentId],
    queryFn: () => tutorsApi.getStudent(studentId),
  });

  if (isLoading) return <FullPageSpinner label="Loading progress..." />;

  if (isError || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        title={notFound ? "Student not found" : "Couldn't load this student"}
        description={
          notFound
            ? "This student is not enrolled in any of your courses, or their account no longer exists."
            : "Their progress didn't load. Check your connection and try again."
        }
        onRetry={notFound ? undefined : () => void refetch()}
      />
    );
  }

  return <StudentProgressView detail={data} role="tutor" />;
}
