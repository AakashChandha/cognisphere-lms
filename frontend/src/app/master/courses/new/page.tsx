"use client";

import { CourseCreateForm } from "@/components/courses/course-create-form";

export default function MasterNewCoursePage() {
  return <CourseCreateForm basePath="/master/courses" isMaster />;
}
