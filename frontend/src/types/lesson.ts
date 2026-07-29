export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  orderIndex: number;
  filesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonPayload {
  title: string;
  content: string;
  orderIndex?: number;
}

export interface UpdateLessonPayload {
  title?: string;
  content?: string;
  orderIndex?: number;
}
