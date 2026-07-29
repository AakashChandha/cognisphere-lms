import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type { CourseFile } from "@/types/course-file";

/**
 * File downloads require the `Authorization` header, which a plain `<a>`
 * navigation cannot send (tokens live in localStorage, not cookies). This
 * fetches the file as a blob through the authenticated axios client and
 * triggers a native save via a temporary object URL.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  // `apiClient`'s baseURL already includes `/api`; strip it from URLs returned
  // by the backend (e.g. `CourseFile.downloadUrl`) to avoid a doubled prefix.
  const relativeUrl = url.startsWith("/api/") ? url.slice(4) : url;
  const response = await apiClient.get<Blob>(relativeUrl, { responseType: "blob" });
  const objectUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
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
