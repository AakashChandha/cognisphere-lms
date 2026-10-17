import { apiClient, unwrap, unwrapPaginated } from "./client";
import { cleanParams } from "./query-string";
import { ApiError, type ApiEnvelope, type PaginationQuery } from "@/types/api";
import type { FileStreamUrl } from "@/types/course-file";
import type {
  AssessmentDetail,
  AssessmentQuestionDto,
  AssessmentSummary,
  AttemptDetail,
  AttemptSummary,
  AttemptsQuery,
  AuthoringRole,
  CreateAssessmentPayload,
  GradeAttemptPayload,
  QuestionPayload,
  StudentAssessmentDetail,
  StudentAssessmentSummary,
  SubmitMcqPayload,
  UpdateAssessmentPayload,
} from "@/types/assessment";

/** Question papers and submissions are PDFs; the API accepts nothing else. */
export const PDF_ACCEPT = "application/pdf,.pdf";
export const PDF_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Ask for a short-lived, same-origin URL an `<iframe>` can open directly.
 * The contract specifies POST for the new assessment file endpoints while the
 * pre-existing course-file endpoint is a GET, so the other verb is retried
 * once on 404/405 rather than leaving the viewer dead.
 */
async function requestStreamUrl(path: string, preferred: "post" | "get" = "post"): Promise<FileStreamUrl> {
  const send = (verb: "post" | "get") =>
    verb === "post"
      ? unwrap(apiClient.post<ApiEnvelope<FileStreamUrl>>(path))
      : unwrap(apiClient.get<ApiEnvelope<FileStreamUrl>>(path));
  try {
    return await send(preferred);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return send(preferred === "post" ? "get" : "post");
    }
    throw error;
  }
}

function uploadPdf<T>(path: string, file: File, onProgress?: (percent: number) => void) {
  const formData = new FormData();
  formData.append("file", file);
  return unwrap(
    apiClient.post<ApiEnvelope<T>>(path, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 10 * 60 * 1000,
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    }),
  );
}

/**
 * Authoring + grading surface. TUTOR is scoped to its own courses, MASTER to
 * everything; the two controllers are identical apart from the prefix, so one
 * factory serves both.
 */
function createAuthoringApi(role: AuthoringRole) {
  const base = `/${role}`;
  return {
    role,
    listForCourse(courseId: string, params: PaginationQuery = {}) {
      return unwrapPaginated(
        apiClient.get<ApiEnvelope<AssessmentSummary[]>>(`${base}/courses/${courseId}/assessments`, {
          params: cleanParams(params),
        }),
      );
    },
    create(courseId: string, payload: CreateAssessmentPayload) {
      return unwrap(
        apiClient.post<ApiEnvelope<AssessmentDetail>>(`${base}/courses/${courseId}/assessments`, payload),
      );
    },
    getById(id: string) {
      return unwrap(apiClient.get<ApiEnvelope<AssessmentDetail>>(`${base}/assessments/${id}`));
    },
    update(id: string, payload: UpdateAssessmentPayload) {
      return unwrap(apiClient.patch<ApiEnvelope<AssessmentDetail>>(`${base}/assessments/${id}`, payload));
    },
    remove(id: string) {
      return unwrap(apiClient.delete<ApiEnvelope<null>>(`${base}/assessments/${id}`));
    },
    publish(id: string) {
      return unwrap(apiClient.post<ApiEnvelope<AssessmentDetail>>(`${base}/assessments/${id}/publish`));
    },
    unpublish(id: string) {
      return unwrap(apiClient.post<ApiEnvelope<AssessmentDetail>>(`${base}/assessments/${id}/unpublish`));
    },
    createQuestion(assessmentId: string, payload: QuestionPayload) {
      return unwrap(
        apiClient.post<ApiEnvelope<AssessmentQuestionDto>>(
          `${base}/assessments/${assessmentId}/questions`,
          payload,
        ),
      );
    },
    updateQuestion(assessmentId: string, questionId: string, payload: QuestionPayload) {
      return unwrap(
        apiClient.patch<ApiEnvelope<AssessmentQuestionDto>>(
          `${base}/assessments/${assessmentId}/questions/${questionId}`,
          payload,
        ),
      );
    },
    deleteQuestion(assessmentId: string, questionId: string) {
      return unwrap(
        apiClient.delete<ApiEnvelope<null>>(`${base}/assessments/${assessmentId}/questions/${questionId}`),
      );
    },
    reorderQuestions(assessmentId: string, questionIds: string[]) {
      return unwrap(
        apiClient.patch<ApiEnvelope<AssessmentQuestionDto[]>>(
          `${base}/assessments/${assessmentId}/questions/reorder`,
          { questionIds },
        ),
      );
    },
    uploadQuestionPaper(assessmentId: string, file: File, onProgress?: (percent: number) => void) {
      return uploadPdf<AssessmentDetail>(`${base}/assessments/${assessmentId}/question-paper`, file, onProgress);
    },
    deleteQuestionPaper(assessmentId: string, fileId: string) {
      return unwrap(
        apiClient.delete<ApiEnvelope<null>>(`${base}/assessments/${assessmentId}/question-paper/${fileId}`),
      );
    },
    listAttempts(assessmentId: string, params: AttemptsQuery = {}) {
      return unwrapPaginated(
        apiClient.get<ApiEnvelope<AttemptSummary[]>>(`${base}/assessments/${assessmentId}/attempts`, {
          params: cleanParams(params),
        }),
      );
    },
    /** Cross-course review queue: every attempt the actor can see. */
    listAllAttempts(params: AttemptsQuery = {}) {
      return unwrapPaginated(
        apiClient.get<ApiEnvelope<AttemptSummary[]>>(`${base}/assessment-attempts`, {
          params: cleanParams(params),
        }),
      );
    },
    getAttempt(attemptId: string) {
      return unwrap(apiClient.get<ApiEnvelope<AttemptDetail>>(`${base}/attempts/${attemptId}`));
    },
    gradeAttempt(attemptId: string, payload: GradeAttemptPayload) {
      return unwrap(
        apiClient.post<ApiEnvelope<AttemptDetail>>(`${base}/attempts/${attemptId}/grade`, payload),
      );
    },
    submissionStreamUrl(attemptId: string, fileId: string) {
      return requestStreamUrl(`${base}/attempts/${attemptId}/files/${fileId}/stream-url`);
    },
    /**
     * The contract defines no authoring-side stream URL for a question paper,
     * so the paper is previewed through the existing role-scoped file endpoint
     * (`GET /{role}/files/:id/stream-url`), which serves any file the actor owns.
     */
    fileStreamUrl(fileId: string) {
      return requestStreamUrl(`${base}/files/${fileId}/stream-url`, "get");
    },
  };
}

export const tutorAssessmentsApi = createAuthoringApi("tutor");
export const masterAssessmentsApi = createAuthoringApi("master");

export type AssessmentsAuthoringApi = ReturnType<typeof createAuthoringApi>;

/** Picks the controller pair that matches the signed-in role. */
export function assessmentsApiFor(role: AuthoringRole): AssessmentsAuthoringApi {
  return role === "master" ? masterAssessmentsApi : tutorAssessmentsApi;
}

export const studentAssessmentsApi = {
  listForCourse(courseId: string) {
    return unwrap(
      apiClient.get<ApiEnvelope<StudentAssessmentSummary[]>>(`/student/courses/${courseId}/assessments`),
    );
  },
  getById(id: string) {
    return unwrap(apiClient.get<ApiEnvelope<StudentAssessmentDetail>>(`/student/assessments/${id}`));
  },
  /** Returns the existing IN_PROGRESS attempt when there is one; 409 after a pass. */
  startAttempt(id: string) {
    return unwrap(apiClient.post<ApiEnvelope<AttemptDetail>>(`/student/assessments/${id}/attempts`));
  },
  submitMcq(attemptId: string, payload: SubmitMcqPayload) {
    return unwrap(apiClient.post<ApiEnvelope<AttemptDetail>>(`/student/attempts/${attemptId}/submit`, payload));
  },
  uploadDocument(attemptId: string, file: File, onProgress?: (percent: number) => void) {
    return uploadPdf<AttemptDetail>(`/student/attempts/${attemptId}/document`, file, onProgress);
  },
  listAttempts(params: AttemptsQuery = {}) {
    return unwrapPaginated(
      apiClient.get<ApiEnvelope<AttemptSummary[]>>("/student/attempts", { params: cleanParams(params) }),
    );
  },
  getAttempt(attemptId: string) {
    return unwrap(apiClient.get<ApiEnvelope<AttemptDetail>>(`/student/attempts/${attemptId}`));
  },
  questionPaperStreamUrl(assessmentId: string) {
    return requestStreamUrl(`/student/assessments/${assessmentId}/question-paper/stream-url`);
  },
  /**
   * Not in the contract: the student side mirrors the tutor's
   * `attempts/:id/files/:fileId/stream-url` so a student can re-read the PDF
   * they submitted. If the API does not expose it the viewer shows an error
   * rather than breaking the page.
   */
  submissionStreamUrl(attemptId: string, fileId: string) {
    return requestStreamUrl(`/student/attempts/${attemptId}/files/${fileId}/stream-url`);
  },
};
