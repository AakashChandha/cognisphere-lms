import type { AuditAction } from "./audit-log";

export interface RecentAuditLogSummary {
  id: string;
  action: AuditAction;
  entityType: string;
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
  recentActivity: RecentAuditLogSummary[];
}

export interface TutorDashboard {
  totalCourses: number;
  draftCourses: number;
  publishedCourses: number;
  archivedCourses: number;
  totalStudents: number;
  totalLessons: number;
  totalFiles: number;
}

export interface DashboardCourseSummary {
  id: string;
  title: string;
  status: string;
  thumbnailUrl: string | null;
}

export interface DashboardAnnouncementSummary {
  id: string;
  title: string;
  createdAt: string;
}

export interface StudentDashboard {
  enrolledCoursesCount: number;
  recentCourses: DashboardCourseSummary[];
  recentAnnouncements: DashboardAnnouncementSummary[];
}
