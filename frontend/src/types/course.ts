export enum CourseStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
  /** Admin switched the course off: students lose access, the tutor can view but not edit. */
  DEACTIVATED = "DEACTIVATED",
}

export interface CourseTutorSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: CourseStatus;
  thumbnailUrl: string | null;
  /** Null when the tutor was removed and the course awaits reassignment. */
  tutor: CourseTutorSummary | null;
  /** Only present when a student fetches their own courses. */
  progress?: CourseProgress;
  lessonsCount: number;
  filesCount: number;
  enrollmentsCount: number;
  publishedAt: string | null;
  /** Set while the status is DEACTIVATED. */
  deactivatedAt: string | null;
  deactivationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoursePayload {
  title: string;
  description: string;
  thumbnailUrl?: string;
  /** Master only: Tutor profile id to assign the course to. Omit to leave it unassigned. */
  tutorId?: string;
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
  /** Master only: list courses with no tutor. */
  unassigned?: "true";
}
