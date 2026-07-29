export enum CourseStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export interface CourseTutorSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  thumbnailUrl: string | null;
  tutor: CourseTutorSummary;
  lessonsCount: number;
  filesCount: number;
  enrollmentsCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoursePayload {
  title: string;
  description: string;
  thumbnailUrl?: string;
}

export interface UpdateCoursePayload {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface QueryCourseParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: CourseStatus;
}
