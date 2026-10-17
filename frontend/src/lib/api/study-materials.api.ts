import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import type { ApiEnvelope } from "@/types/api";
import type { PreviewFile } from "@/types/course-file";
import type {
  StudyMaterial,
  StudyMaterialManagerRole,
  StudyMaterialQuery,
  UpdateStudyMaterialPayload,
} from "@/types/study-material";

/**
 * Turn a study material into something the shared preview pane can open. The
 * stream-url endpoint is a POST here (the older course-file one is a GET), and
 * there is no authenticated bytes URL, so PPTX is read through the signed URL.
 */
export function studyMaterialToPreviewFile(
  material: StudyMaterial,
  role: StudyMaterialManagerRole | "student",
): PreviewFile {
  return {
    id: material.id,
    originalName: material.originalName,
    mimeType: material.mimeType,
    streamUrlEndpoint: `/${role}/study-materials/${material.id}/stream-url`,
    streamUrlMethod: "POST",
  };
}

/** Upload / edit / delete side, mounted identically under `/tutor` and `/master`. */
export function studyMaterialsApi(role: StudyMaterialManagerRole) {
  return {
    list(params: StudyMaterialQuery) {
      return unwrapPaginated(
        apiClient.get<ApiEnvelope<StudyMaterial[]>>(`/${role}/study-materials`, {
          params: cleanParams(params),
        }),
      );
    },
    upload(
      courseId: string,
      input: { file: File; title: string; description?: string },
      onProgress?: (percent: number) => void,
    ) {
      const formData = new FormData();
      formData.append("file", input.file);
      formData.append("title", input.title);
      if (input.description) formData.append("description", input.description);

      return unwrap(
        apiClient.post<ApiEnvelope<StudyMaterial>>(`/${role}/courses/${courseId}/study-materials`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          // Reference books and recordings can be large on a slow link.
          timeout: 30 * 60 * 1000,
          onUploadProgress: (event) => {
            if (onProgress && event.total) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          },
        }),
      );
    },
    update(id: string, payload: UpdateStudyMaterialPayload) {
      return unwrap(apiClient.patch<ApiEnvelope<StudyMaterial>>(`/${role}/study-materials/${id}`, payload));
    },
    remove(id: string) {
      return unwrap(apiClient.delete<ApiEnvelope<null>>(`/${role}/study-materials/${id}`));
    },
  };
}

export const studentStudyMaterialsApi = {
  /** Only materials of courses the student is enrolled in; the server enforces it. */
  list(params: StudyMaterialQuery) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<StudyMaterial[]>>("/student/study-materials", {
        params: cleanParams(params),
      }),
    );
  },
};
