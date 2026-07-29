import { apiClient, unwrap } from "./client";
import type { ApiEnvelope } from "@/types/api";
import type { CreateLessonPayload, Lesson, UpdateLessonPayload } from "@/types/lesson";

export const tutorLessonsApi = {
  listForCourse(courseId: string) {
    return unwrap(apiClient.get<ApiEnvelope<Lesson[]>>(`/tutor/courses/${courseId}/lessons`));
  },
  create(courseId: string, payload: CreateLessonPayload) {
    return unwrap(
      apiClient.post<ApiEnvelope<Lesson>>(`/tutor/courses/${courseId}/lessons`, payload),
    );
  },
  update(id: string, payload: UpdateLessonPayload) {
    return unwrap(apiClient.put<ApiEnvelope<Lesson>>(`/tutor/lessons/${id}`, payload));
  },
  remove(id: string) {
    return unwrap(apiClient.delete<ApiEnvelope<null>>(`/tutor/lessons/${id}`));
  },
};

export const studentLessonsApi = {
  listForCourse(courseId: string) {
    return unwrap(apiClient.get<ApiEnvelope<Lesson[]>>(`/student/courses/${courseId}/lessons`));
  },
  getById(id: string) {
    return unwrap(apiClient.get<ApiEnvelope<Lesson>>(`/student/lessons/${id}`));
  },
};
