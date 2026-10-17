import type { PaginationQuery } from "@/types/api";

export type AssessmentType = "MCQ" | "DOCUMENT";
export type AssessmentStatus = "DRAFT" | "PUBLISHED";
export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "PASSED" | "FAILED";
/** What a student sees on an assessment they may not have started yet. */
export type StudentAssessmentStatus = "NOT_STARTED" | AttemptStatus;

/** Which role-scoped controller pair to talk to. MASTER is accepted everywhere TUTOR is. */
export type AuthoringRole = "tutor" | "master";

/** A stored file the client can only view, never download (question paper, submission). */
export interface AssessmentFileRef {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AssessmentSummary {
  id: string;
  courseId: string;
  courseTitle: string;
  type: AssessmentType;
  title: string;
  instructions: string;
  passPercent: number;
  timeLimitMinutes: number | null;
  status: AssessmentStatus;
  orderIndex: number;
  /** MCQ only. */
  questionCount: number;
  /** DOCUMENT only. */
  hasQuestionPaper: boolean;
  /** All attempts, all students. */
  attemptCount: number;
  /** Attempts sitting in SUBMITTED, waiting for a tutor. */
  awaitingReviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentOptionDto {
  id: string;
  text: string;
  orderIndex: number;
  /** Present for tutor/master only, never for students. */
  isCorrect?: boolean;
}

export interface AssessmentQuestionDto {
  id: string;
  prompt: string;
  points: number;
  orderIndex: number;
  options: AssessmentOptionDto[];
}

export interface AssessmentDetail extends AssessmentSummary {
  questions: AssessmentQuestionDto[];
  questionPaper: AssessmentFileRef | null;
}

export interface StudentAssessmentSummary {
  id: string;
  courseId: string;
  courseTitle: string;
  type: AssessmentType;
  title: string;
  instructions: string;
  passPercent: number;
  timeLimitMinutes: number | null;
  questionCount: number;
  myStatus: StudentAssessmentStatus;
  bestScorePercent: number | null;
  attemptsCount: number;
  latestAttemptId: string | null;
}

export interface StudentAssessmentDetail extends StudentAssessmentSummary {
  /** Options never carry `isCorrect` on this route. */
  questions: AssessmentQuestionDto[];
  questionPaper: AssessmentFileRef | null;
  activeAttemptId: string | null;
}

export interface AttemptStudentRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AttemptSummary {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentType: AssessmentType;
  courseId: string;
  courseTitle: string;
  student: AttemptStudentRef;
  attemptNumber: number;
  status: AttemptStatus;
  scorePercent: number | null;
  passPercent: number;
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
}

export interface AttemptAnswerDto {
  questionId: string;
  prompt: string;
  points: number;
  chosenOptionId: string | null;
  options: { id: string; text: string; isCorrect?: boolean }[];
}

export interface AttemptSubmissionFile extends AssessmentFileRef {
  createdAt: string;
}

export interface AttemptDetail extends AttemptSummary {
  feedback: string | null;
  gradedBy: { id: string; firstName: string; lastName: string } | null;
  /** MCQ: the full question with the student's choice marked. Empty for DOCUMENT. */
  answers: AttemptAnswerDto[];
  /** DOCUMENT: the PDFs the student uploaded. Empty for MCQ. */
  submissions: AttemptSubmissionFile[];
}

export interface CreateAssessmentPayload {
  type: AssessmentType;
  title: string;
  instructions?: string;
  passPercent?: number;
  timeLimitMinutes?: number | null;
}

export interface UpdateAssessmentPayload {
  title?: string;
  instructions?: string;
  passPercent?: number;
  timeLimitMinutes?: number | null;
}

export interface QuestionOptionPayload {
  text: string;
  isCorrect: boolean;
}

export interface QuestionPayload {
  prompt: string;
  points?: number;
  /** At least two, exactly one correct. The whole option set is replaced on update. */
  options: QuestionOptionPayload[];
}

export interface SubmitMcqPayload {
  answers: { questionId: string; optionId: string }[];
}

export interface GradeAttemptPayload {
  passed: boolean;
  scorePercent?: number;
  /** Required by the API: a student always gets a reason. */
  feedback: string;
}

export interface AttemptsQuery extends PaginationQuery {
  status?: AttemptStatus;
}
