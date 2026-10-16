import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';

class RecentAuditLogSummary {
  @ApiProperty() id: string;
  @ApiProperty({ enum: AuditAction }) action: AuditAction;
  @ApiProperty() entityType: string;
  @ApiProperty({ nullable: true }) entityId: string | null;
  @ApiProperty({ nullable: true }) actorName: string | null;
  @ApiProperty() createdAt: Date;
}

export class MasterDashboardDto {
  @ApiProperty() totalUsers: number;
  @ApiProperty() activeUsers: number;
  @ApiProperty() disabledUsers: number;
  @ApiProperty() totalStudents: number;
  @ApiProperty() totalTutors: number;
  @ApiProperty() totalCourses: number;
  @ApiProperty() publishedCourses: number;
  @ApiProperty() draftCourses: number;
  @ApiProperty() archivedCourses: number;
  @ApiProperty() deactivatedCourses: number;
  @ApiProperty() totalEnrollments: number;
  @ApiProperty() totalAnnouncements: number;
  @ApiProperty({ description: 'Courses whose tutor was removed and that need reassigning' })
  unassignedCourses: number;
  @ApiProperty({ type: [RecentAuditLogSummary] }) recentActivity: RecentAuditLogSummary[];
}
