import { ApiProperty } from '@nestjs/swagger';

export class TutorDashboardDto {
  @ApiProperty() totalCourses: number;
  @ApiProperty() draftCourses: number;
  @ApiProperty() publishedCourses: number;
  @ApiProperty() archivedCourses: number;
  @ApiProperty() totalStudents: number;
  @ApiProperty() totalLessons: number;
  @ApiProperty() totalFiles: number;
}
