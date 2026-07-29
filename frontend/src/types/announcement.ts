export enum AnnouncementAudience {
  ALL = "ALL",
  STUDENTS = "STUDENTS",
  TUTORS = "TUTORS",
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: AnnouncementAudience;
  courseId: string | null;
  courseTitle: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  content: string;
  audience?: AnnouncementAudience;
  courseId?: string;
}

export type UpdateAnnouncementPayload = Partial<CreateAnnouncementPayload>;
