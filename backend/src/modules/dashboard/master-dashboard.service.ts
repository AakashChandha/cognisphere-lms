import { Injectable } from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MasterDashboardDto } from './dto/master-dashboard.dto';

@Injectable()
export class MasterDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<MasterDashboardDto> {
    const [
      totalUsers,
      activeUsers,
      totalStudents,
      totalTutors,
      courseCounts,
      totalEnrollments,
      totalAnnouncements,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.student.count(),
      this.prisma.tutor.count(),
      this.prisma.course.groupBy({ by: ['status'], _count: true }),
      this.prisma.enrollment.count(),
      this.prisma.announcement.count(),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    const countByStatus = (status: CourseStatus) =>
      courseCounts.find((c) => c.status === status)?._count ?? 0;

    return {
      totalUsers,
      activeUsers,
      disabledUsers: totalUsers - activeUsers,
      totalStudents,
      totalTutors,
      totalCourses: courseCounts.reduce((sum, c) => sum + c._count, 0),
      publishedCourses: countByStatus(CourseStatus.PUBLISHED),
      draftCourses: countByStatus(CourseStatus.DRAFT),
      archivedCourses: countByStatus(CourseStatus.ARCHIVED),
      totalEnrollments,
      totalAnnouncements,
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        createdAt: log.createdAt,
      })),
    };
  }
}
