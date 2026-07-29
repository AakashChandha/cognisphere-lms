import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type { CourseFile } from "@/types/course-file";

function toRelativeApiUrl(url: string): string {
  // `apiClient`'s baseURL already includes `/api`; strip it from URLs returned
  // by the backend (e.g. `CourseFile.downloadUrl`) to avoid a doubled prefix.
  return url.startsWith("/api/") ? url.slice(4) : url;
}

/** Authenticated fetch of a course file as a Blob for in-browser preview. */
export async function fetchFileBlob(url: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(toRelativeApiUrl(url), {
    responseType: "blob",
    timeout: 120_000,
  });
  return response.data;
}

export const tutorFilesApi = {
  listAll(params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<CourseFile[]>>("/tutor/files", { params: cleanParams(params) }),
    );
  },
  listForCourse(courseId: string, params: PaginationQuery = {}) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<CourseFile[]>>(`/tutor/courses/${courseId}/files`, {
        params: cleanParams(params),
      }),
    );
  },
  upload(courseId: string, file: File, lessonId?: string, onProgress?: (percent: number) => void) {
    const formData = new FormData();
    formData.append("file", file);
    if (lessonId) formData.append("lessonId", lessonId);

    return unwrap(
      apiClient.post<ApiEnvelope<CourseFile>>(`/tutor/courses/${courseId}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      }),
    );
  },
  remove(id: string) {
    return unwrap(apiClient.delete<ApiEnvelope<null>>(`/tutor/files/${id}`));
  },
};

export const studentFilesApi = {
  listAll(params: PaginationQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<CourseFile[]>>("/student/files", { params: cleanParams(params) }),
    );
  },
  listForCourse(courseId: string, params: PaginationQuery = {}) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<CourseFile[]>>(`/student/courses/${courseId}/files`, {
        params: cleanParams(params),
      }),
    );
  },
};
