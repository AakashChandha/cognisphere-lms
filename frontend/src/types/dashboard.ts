import type { AuditAction } from "./audit-log";

export interface RecentAuditLogSummary {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface MasterDashboard {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  totalStudents: number;
  totalTutors: number;
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  archivedCourses: number;
  totalEnrollments: number;
  totalAnnouncements: number;
  unassignedCourses: number;
  recentActivity: RecentAuditLogSummary[];
}

export interface TutorDashboardCourseSummary {
  id: string;
  title: string;
  status: string;
  lessonsCount: number;
  enrollmentsCount: number;
  updatedAt: string;
}

export interface TutorDashboardEnrollmentSummary {
  studentName: string;
  courseId: string;
  courseTitle: string;
  enrolledAt: string;
}

export interface TutorDashboard {
  totalCourses: number;
  draftCourses: number;
  publishedCourses: number;
  archivedCourses: number;
  totalStudents: number;
  totalLessons: number;
  totalFiles: number;
  needsAttention: TutorDashboardCourseSummary[];
  recentCourses: TutorDashboardCourseSummary[];
  recentEnrollments: TutorDashboardEnrollmentSummary[];
}

export interface DashboardCourseSummary {
  id: string;
  title: string;
  status: string;
  thumbnailUrl: string | null;
  tutorName: string;
  completedLessons: number;
  totalLessons: number;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
}

export interface ContinueLearningSummary {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonNumber: number;
  completedLessons: number;
  totalLessons: number;
}

export interface DashboardAnnouncementSummary {
  id: string;
  title: string;
  createdAt: string;
}

export interface StudentDashboard {
  enrolledCoursesCount: number;
  continueLearning: ContinueLearningSummary | null;
  recentCourses: DashboardCourseSummary[];
  recentAnnouncements: DashboardAnnouncementSummary[];
}
