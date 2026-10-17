import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope, PaginationQuery } from "@/types/api";
import type { CourseFile, FileStreamUrl, PreviewFile } from "@/types/course-file";
import type { FileViewedResult } from "@/types/lesson";

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
export async function getFileStreamUrl(file: PreviewFile): Promise<FileStreamUrl> {
  const url = toRelativeApiUrl(file.streamUrlEndpoint);
  return unwrap(
    file.streamUrlMethod === "POST"
      ? apiClient.post<ApiEnvelope<FileStreamUrl>>(url)
      : apiClient.get<ApiEnvelope<FileStreamUrl>>(url),
  );
}

/** Authenticated fetch of a course file as a Blob (PPTX preview needs the bytes in memory). */
export async function fetchFileBlob(url: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(toRelativeApiUrl(url), {
    responseType: "blob",
    timeout: 120_000,
  });
  return response.data;
}

/**
 * Bytes for a client-side renderer (PPTX). Course files expose an
 * authenticated `downloadUrl`; anything else is read through its signed
 * stream URL, which carries its own token and needs no header.
 */
export async function fetchPreviewBytes(file: PreviewFile): Promise<ArrayBuffer> {
  if (file.downloadUrl) {
    const blob = await fetchFileBlob(file.downloadUrl);
    return blob.arrayBuffer();
  }
  const { url } = await getFileStreamUrl(file);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load the file (${response.status})`);
  return response.arrayBuffer();
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
  listForCourse(courseId: string, params: PaginationQuery = {}) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<CourseFile[]>>(`/student/courses/${courseId}/files`, {
        params: cleanParams(params),
      }),
    );
  },
  /**
   * Records that the student reached the end of this file. Idempotent on the
   * server; the response says whether that was the last file the lesson needed.
   */
  markViewed(fileId: string) {
    return unwrap(apiClient.post<ApiEnvelope<FileViewedResult>>(`/student/files/${fileId}/viewed`));
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
