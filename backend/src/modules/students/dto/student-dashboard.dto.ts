import { ApiProperty } from '@nestjs/swagger';

class DashboardCourseSummary {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true }) thumbnailUrl: string | null;
}

class DashboardAnnouncementSummary {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() createdAt: Date;
}

export class StudentDashboardDto {
  @ApiProperty() enrolledCoursesCount: number;
  @ApiProperty({ type: [DashboardCourseSummary] }) recentCourses: DashboardCourseSummary[];
  @ApiProperty({ type: [DashboardAnnouncementSummary] })
  recentAnnouncements: DashboardAnnouncementSummary[];
}
