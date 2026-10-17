export enum CourseStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
  /** Admin switched the course off: students lose access, the tutor can view but not edit. */
  DEACTIVATED = "DEACTIVATED",
}

/**
 * `FREE` - students open lessons in any order.
 * `SEQUENTIAL` - a lesson stays locked until every earlier lesson is complete.
 */
export type CourseProgressionMode = "FREE" | "SEQUENTIAL";

export const PROGRESSION_MODE_LABEL: Record<CourseProgressionMode, string> = {
  FREE: "Students can move freely between lessons",
  SEQUENTIAL: "Students must finish each lesson before the next unlocks",
};

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
  /**
   * How students move through the lessons. Optional so the UI still renders
   * against an API that has not shipped the field yet; treat a missing value
   * as `FREE`.
   */
  progressionMode?: CourseProgressionMode;
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
  progressionMode?: CourseProgressionMode;
  /** Master only: Tutor profile id to assign the course to. Omit to leave it unassigned. */
  tutorId?: string;
}

export interface UpdateCoursePayload {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  progressionMode?: CourseProgressionMode;
}

export interface CourseThumbnail {
  thumbnailUrl: string;
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
