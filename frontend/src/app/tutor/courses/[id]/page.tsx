"use client";

import { useParams } from "next/navigation";
import { CourseEditor } from "@/components/courses/course-editor";

export default function TutorCourseDetailPage() {
  const params = useParams<{ id: string }>();
  return <CourseEditor courseId={params.id} basePath="/tutor/courses" isMaster={false} />;
}
