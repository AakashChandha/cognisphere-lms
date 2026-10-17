"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AttemptReviewQueue } from "@/components/assessments/attempt-review-queue";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";

function ReviewQueue() {
  // `?assessmentId=` narrows the queue to one assessment's attempts.
  const searchParams = useSearchParams();
  return <AttemptReviewQueue role="tutor" assessmentId={searchParams.get("assessmentId")} />;
}

export default function TutorAssessmentsPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <ReviewQueue />
    </Suspense>
  );
}
