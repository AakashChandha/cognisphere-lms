import { ApiProperty } from '@nestjs/swagger';

class DashboardCourseSummary {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true }) thumbnailUrl: string | null;
  @ApiProperty() tutorName: string;
  @ApiProperty() completedLessons: number;
  @ApiProperty() totalLessons: number;
  @ApiProperty({ nullable: true }) nextLessonId: string | null;
  @ApiProperty({ nullable: true }) nextLessonTitle: string | null;
}

class ContinueLearningSummary {
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty() lessonId: string;
  @ApiProperty() lessonTitle: string;
  @ApiProperty() lessonNumber: number;
  @ApiProperty() completedLessons: number;
  @ApiProperty() totalLessons: number;
}

class DashboardAnnouncementSummary {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() createdAt: Date;
}

export class StudentDashboardDto {
  @ApiProperty() enrolledCoursesCount: number;
  @ApiProperty({ type: ContinueLearningSummary, nullable: true, description: 'Where the student should pick up next' })
  continueLearning: ContinueLearningSummary | null;
  @ApiProperty({ type: [DashboardCourseSummary] }) recentCourses: DashboardCourseSummary[];
  @ApiProperty({ type: [DashboardAnnouncementSummary] })
  recentAnnouncements: DashboardAnnouncementSummary[];
}
