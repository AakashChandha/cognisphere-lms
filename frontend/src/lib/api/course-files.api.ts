import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type { CourseFile, FileStreamUrl } from "@/types/course-file";

function toRelativeApiUrl(url: string): string {
  // `apiClient`'s baseURL already includes `/api`; strip it from URLs returned
  // by the backend (e.g. `CourseFile.downloadUrl`) to avoid a doubled prefix.
  return url.startsWith("/api/") ? url.slice(4) : url;
}

/**
 * Ask the API for a short-lived, same-origin URL that `<video>` / `<iframe>`
 * can open directly. Those elements cannot send the Bearer header, and a
 * video must be streamed with Range requests rather than downloaded whole.
 */
export async function getFileStreamUrl(file: CourseFile): Promise<FileStreamUrl> {
  return unwrap(apiClient.get<ApiEnvelope<FileStreamUrl>>(toRelativeApiUrl(file.streamUrlEndpoint)));
}

/** Authenticated fetch of a course file as a Blob (PPTX preview needs the bytes in memory). */
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
        // Course videos can be hundreds of MB on an ordinary upload link.
        timeout: 30 * 60 * 1000,
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      }),
    );
  },
  /** Attach to a lesson, or pass null to make the file a course-wide resource. */
  setLesson(id: string, lessonId: string | null) {
    return unwrap(apiClient.patch<ApiEnvelope<CourseFile>>(`/tutor/files/${id}`, { lessonId }));
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

export const masterFilesApi = {
  listForCourse(courseId: string, params: PaginationQuery = {}) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<CourseFile[]>>(`/master/courses/${courseId}/files`, {
        params: cleanParams(params),
      }),
    );
  },
};
