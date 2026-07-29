import { ApiProperty } from '@nestjs/swagger';
import { CourseStatus } from '@prisma/client';

export class CourseTutorSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
}

export class CourseResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: CourseStatus }) status: CourseStatus;
  @ApiProperty({ nullable: true }) thumbnailUrl: string | null;
  @ApiProperty({ type: CourseTutorSummaryDto }) tutor: CourseTutorSummaryDto;
  @ApiProperty() lessonsCount: number;
  @ApiProperty() filesCount: number;
  @ApiProperty() enrollmentsCount: number;
  @ApiProperty({ nullable: true }) publishedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
