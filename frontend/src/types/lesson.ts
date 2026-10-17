import type { CourseFile } from "./course-file";

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  orderIndex: number;
  filesCount: number;
  /** Only for students: whether they marked this lesson complete. */
  completed?: boolean;
  /**
   * Students only: the server's view of completion (every attached file read
   * to the end, or an explicit "mark complete" for a lesson with no files).
   */
  isCompleted?: boolean;
  /**
   * Students only, and only in `SEQUENTIAL` courses: an earlier lesson is
   * still incomplete, so this one cannot be opened yet.
   */
  isLocked?: boolean;
  /**
   * Students only: the files attached to this lesson, each flagged with
   * whether the student has reached its end. Absent on tutor/master responses.
   */
  files?: CourseFile[];
  createdAt: string;
  updatedAt: string;
}

/** True unless the server has explicitly locked the lesson. */
export function isLessonOpen(lesson: Lesson): boolean {
  return lesson.isLocked !== true;
}

/** Tolerates both the old `completed` flag and the new `isCompleted` one. */
export function isLessonComplete(lesson: Lesson): boolean {
  return lesson.isCompleted ?? lesson.completed ?? false;
}

export interface CreateLessonPayload {
  title: string;
  content?: string;
  orderIndex?: number;
}

export interface UpdateLessonPayload {
  title?: string;
  content?: string;
  orderIndex?: number;
}

/** `POST /student/files/:fileId/viewed` */
export interface FileViewedResult {
  lessonCompleted: boolean;
}
