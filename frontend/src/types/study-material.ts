import type { PaginationQuery } from "./api";

/**
 * A reference file (a book, a standard, a handout) attached to a course by a
 * tutor or an admin. Stored as a `CourseFile` with `purpose=STUDY_MATERIAL`;
 * students see only the materials of courses they are enrolled in, and can
 * view but never download them.
 */
export interface StudyMaterial {
  id: string;
  title: string;
  description: string | null;
  courseId: string;
  courseTitle: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface StudyMaterialQuery extends PaginationQuery {
  courseId?: string;
}

export interface UpdateStudyMaterialPayload {
  title?: string;
  description?: string;
  courseId?: string;
}

/** Roles that can upload and manage study materials. */
export type StudyMaterialManagerRole = "tutor" | "master";
