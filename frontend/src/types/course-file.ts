export interface CourseFile {
  id: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  /** GET this to receive a short-lived URL the browser can open directly (video/PDF). */
  streamUrlEndpoint: string;
  /**
   * Student view only: the student has already reached the end of this file,
   * so it counts towards completing its lesson.
   */
  isViewed?: boolean;
  createdAt: string;
}

export interface FileStreamUrl {
  url: string;
  expiresInSeconds: number;
}

/**
 * The minimum a viewer needs to render something. `CourseFile` satisfies it,
 * and study materials / assessment papers are adapted into it, so one preview
 * pane serves every kind of stored file.
 */
export interface PreviewFile {
  id: string;
  originalName: string;
  mimeType: string;
  /** Role-scoped endpoint that mints a short-lived, same-origin stream URL. */
  streamUrlEndpoint: string;
  /** Course files use GET; the newer study-material endpoint is a POST. */
  streamUrlMethod?: "GET" | "POST";
  /**
   * Authenticated URL that returns the raw bytes. Present for course files;
   * when absent the pane falls back to fetching the signed stream URL (needed
   * for PPTX, which is rendered in the browser from the bytes).
   */
  downloadUrl?: string | null;
  /** Already marked as read/watched by this student. */
  isViewed?: boolean;
}
