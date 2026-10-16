import { ApiProperty } from '@nestjs/swagger';

class TutorDashboardCourseSummary {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() status: string;
  @ApiProperty() lessonsCount: number;
  @ApiProperty() enrollmentsCount: number;
  @ApiProperty() updatedAt: Date;
}

class TutorDashboardEnrollmentSummary {
  @ApiProperty() studentName: string;
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty() enrolledAt: Date;
}

export class TutorDashboardDto {
  @ApiProperty() totalCourses: number;
  @ApiProperty() draftCourses: number;
  @ApiProperty() publishedCourses: number;
  @ApiProperty() archivedCourses: number;
  @ApiProperty() totalStudents: number;
  @ApiProperty() totalLessons: number;
  @ApiProperty() totalFiles: number;
  @ApiProperty({ type: [TutorDashboardCourseSummary], description: 'Drafts and published courses with nobody enrolled' })
  needsAttention: TutorDashboardCourseSummary[];
  @ApiProperty({ type: [TutorDashboardCourseSummary] }) recentCourses: TutorDashboardCourseSummary[];
  @ApiProperty({ type: [TutorDashboardEnrollmentSummary] }) recentEnrollments: TutorDashboardEnrollmentSummary[];
}
