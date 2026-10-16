"use client";

import { useParams } from "next/navigation";
import { CourseEditor } from "@/components/courses/course-editor";

export default function MasterCourseDetailPage() {
  const params = useParams<{ id: string }>();
  return <CourseEditor courseId={params.id} basePath="/master/courses" isMaster />;
}
