export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  orderIndex: number;
  filesCount: number;
  /** Only for students: whether they marked this lesson complete. */
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
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
