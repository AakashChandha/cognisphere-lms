export interface CourseFile {
  id: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  createdAt: string;
}
