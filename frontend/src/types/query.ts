/**
 * Student↔tutor Q&A threads ("queries"). A query belongs to one course the
 * student is enrolled in and, optionally, to one lesson of that course.
 *
 * The status says **who the thread is waiting on**:
 * - `OPEN` — waiting on a tutor (set on creation and whenever the student posts)
 * - `ANSWERED` — a tutor or admin replied, waiting on the student
 * - `RESOLVED` — the student closed it. Final: no further messages.
 */
export type QueryStatus = "OPEN" | "ANSWERED" | "RESOLVED";

export type QueryAuthorRole = "STUDENT" | "TUTOR" | "MASTER";

export interface QueryMessage {
  id: string;
  body: string;
  createdAt: string;
  /** User id, not the Student/Tutor profile id. */
  authorId: string;
  authorName: string;
  authorRole: QueryAuthorRole;
  /** The caller wrote this message. */
  isMine: boolean;
}

export interface QuerySummary {
  id: string;
  title: string;
  status: QueryStatus;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  studentId: string;
  /** Staff lists show whose question it is. */
  studentName: string;
  messageCount: number;
  lastMessageAt: string;
  /** First 140 characters of the newest message, on one line. */
  lastMessagePreview: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface QueryDetail extends QuerySummary {
  /** Oldest first. */
  messages: QueryMessage[];
  /** False once the thread is RESOLVED. */
  canReply: boolean;
  /** Student only, and only while the thread is not RESOLVED. */
  canResolve: boolean;
}

/** `POST /student/queries` */
export interface CreateQueryPayload {
  courseId: string;
  /** Omit or null to ask about the course as a whole. */
  lessonId?: string | null;
  title: string;
  body: string;
}

/** `POST /{role}/queries/:id/messages` */
export interface CreateQueryMessagePayload {
  body: string;
}

export interface QueryListParams {
  page?: number;
  pageSize?: number;
  /** Student: matches the title. Staff: title, student name or email. */
  search?: string;
  status?: QueryStatus;
  courseId?: string;
}

/** The two staff-side controller prefixes, which are otherwise identical. */
export type QueryStaffRole = "tutor" | "master";

/** Every role that can open a thread. */
export type QueryViewerRole = "student" | QueryStaffRole;
