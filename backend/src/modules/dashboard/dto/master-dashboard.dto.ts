import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';

class RecentAuditLogSummary {
  @ApiProperty() id: string;
  @ApiProperty({ enum: AuditAction }) action: AuditAction;
  @ApiProperty() entityType: string;
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
  @ApiProperty() totalEnrollments: number;
  @ApiProperty() totalAnnouncements: number;
  @ApiProperty({ type: [RecentAuditLogSummary] }) recentActivity: RecentAuditLogSummary[];
}
