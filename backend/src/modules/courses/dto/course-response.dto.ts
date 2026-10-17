import { ApiProperty } from '@nestjs/swagger';
import { CourseProgressionMode, CourseStatus } from '@prisma/client';

export class CourseTutorSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
}

export class CourseProgressDto {
  @ApiProperty() completedLessons: number;
  @ApiProperty() totalLessons: number;
  @ApiProperty({ nullable: true, description: 'First lesson not yet completed, in course order' })
  nextLessonId: string | null;
  @ApiProperty({ nullable: true }) nextLessonTitle: string | null;
}

export class CourseResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: CourseStatus }) status: CourseStatus;
  @ApiProperty({ enum: CourseProgressionMode, description: 'Whether lessons must be taken in order' })
  progressionMode: CourseProgressionMode;
  @ApiProperty({ nullable: true }) thumbnailUrl: string | null;
  @ApiProperty({ type: CourseTutorSummaryDto, nullable: true, description: 'Null when the tutor was removed and the course awaits reassignment' })
  tutor: CourseTutorSummaryDto | null;
  @ApiProperty({ type: CourseProgressDto, required: false, description: 'Only present for the student viewing the course' })
  progress?: CourseProgressDto;
  @ApiProperty() lessonsCount: number;
  @ApiProperty() filesCount: number;
  @ApiProperty() enrollmentsCount: number;
  @ApiProperty({ nullable: true }) publishedAt: Date | null;
  @ApiProperty({ nullable: true, description: 'Set while status is DEACTIVATED' })
  deactivatedAt: Date | null;
  @ApiProperty({ nullable: true }) deactivationReason: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
