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
  createdAt: string;
}

export interface FileStreamUrl {
  url: string;
  expiresInSeconds: number;
}
