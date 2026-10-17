import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type {
  Course,
  CourseThumbnail,
  CreateCoursePayload,
  QueryCourseParams,
  UpdateCoursePayload,
} from "@/types/course";
import type { Student } from "@/types/people";

/**
 * Cover image upload. The endpoint pair exists under both `/tutor` and
 * `/master`, so the caller passes the role it is acting as.
 */
export function uploadCourseThumbnail(role: "tutor" | "master", courseId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return unwrap(
    apiClient.post<ApiEnvelope<CourseThumbnail>>(`/${role}/courses/${courseId}/thumbnail`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 2 * 60 * 1000,
    }),
  );
}

export function removeCourseThumbnail(role: "tutor" | "master", courseId: string) {
  return unwrap(apiClient.delete<ApiEnvelope<null>>(`/${role}/courses/${courseId}/thumbnail`));
}

export const tutorCoursesApi = {
  list(params: QueryCourseParams) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Course[]>>("/tutor/courses", { params: cleanParams(params) }),
    );
  },
  getById(id: string) {
    return unwrap(apiClient.get<ApiEnvelope<Course>>(`/tutor/courses/${id}`));
  },
  create(payload: CreateCoursePayload) {
    return unwrap(apiClient.post<ApiEnvelope<Course>>("/tutor/courses", payload));
  },
  update(id: string, payload: UpdateCoursePayload) {
    return unwrap(apiClient.patch<ApiEnvelope<Course>>(`/tutor/courses/${id}`, payload));
  },
  remove(id: string) {
    return unwrap(apiClient.delete<ApiEnvelope<null>>(`/tutor/courses/${id}`));
  },
  publish(id: string) {
    return unwrap(apiClient.post<ApiEnvelope<Course>>(`/tutor/courses/${id}/publish`));
  },
  unpublish(id: string) {
    return unwrap(apiClient.post<ApiEnvelope<Course>>(`/tutor/courses/${id}/unpublish`));
  },
  archive(id: string) {
    return unwrap(apiClient.post<ApiEnvelope<Course>>(`/tutor/courses/${id}/archive`));
  },
  listStudents(id: string, params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Student[]>>(`/tutor/courses/${id}/students`, {
        params: cleanParams(params),
      }),
    );
  },
  enrollStudent(id: string, studentId: string) {
    return unwrap(apiClient.post<ApiEnvelope<null>>(`/tutor/courses/${id}/students`, { studentId }));
  },
  unenrollStudent(id: string, studentId: string) {
    return unwrap(apiClient.delete<ApiEnvelope<null>>(`/tutor/courses/${id}/students/${studentId}`));
  },
};

export const studentCoursesApi = {
  list(params: QueryCourseParams) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Course[]>>("/student/courses", { params: cleanParams(params) }),
    );
  },
  getById(id: string) {
    return unwrap(apiClient.get<ApiEnvelope<Course>>(`/student/courses/${id}`));
  },
};

export const masterCoursesApi = {
  list(params: QueryCourseParams) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Course[]>>("/master/courses", { params: cleanParams(params) }),
    );
  },
  getById(id: string) {
    return unwrap(apiClient.get<ApiEnvelope<Course>>(`/master/courses/${id}`));
  },
  listStudents(id: string, params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<Student[]>>(`/master/courses/${id}/students`, { params: cleanParams(params) }),
    );
  },
  reassignTutor(id: string, tutorId: string) {
    return unwrap(apiClient.patch<ApiEnvelope<Course>>(`/master/courses/${id}/tutor`, { tutorId }));
  },
  deactivate(id: string, reason: string) {
    return unwrap(apiClient.post<ApiEnvelope<Course>>(`/master/courses/${id}/deactivate`, { reason }));
  },
  reactivate(id: string) {
    return unwrap(apiClient.post<ApiEnvelope<Course>>(`/master/courses/${id}/reactivate`));
  },
};
