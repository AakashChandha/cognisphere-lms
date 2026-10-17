"use client";

import { useParams } from "next/navigation";
import { AttemptReviewPanel } from "@/components/assessments/attempt-review-panel";

export default function TutorAttemptReviewPage() {
  const params = useParams<{ id: string }>();
  return <AttemptReviewPanel attemptId={params.id} role="tutor" />;
}
