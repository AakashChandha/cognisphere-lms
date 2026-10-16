"use client";

import { CourseCreateForm } from "@/components/courses/course-create-form";

export default function NewCoursePage() {
  return <CourseCreateForm basePath="/tutor/courses" isMaster={false} />;
}
