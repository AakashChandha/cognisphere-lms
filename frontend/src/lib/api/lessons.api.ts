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
  reorder(courseId: string, lessonIds: string[]) {
    return unwrap(
      apiClient.patch<ApiEnvelope<Lesson[]>>(`/tutor/courses/${courseId}/lessons/reorder`, { lessonIds }),
    );
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
  setCompleted(id: string, completed: boolean) {
    return completed
      ? unwrap(apiClient.post<ApiEnvelope<null>>(`/student/lessons/${id}/complete`))
      : unwrap(apiClient.delete<ApiEnvelope<null>>(`/student/lessons/${id}/complete`));
  },
};

export const masterLessonsApi = {
  listForCourse(courseId: string) {
    return unwrap(apiClient.get<ApiEnvelope<Lesson[]>>(`/master/courses/${courseId}/lessons`));
  },
};
