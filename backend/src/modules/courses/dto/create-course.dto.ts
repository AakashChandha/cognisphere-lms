import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsUrl, MaxLength, MinLength } from 'class-validator';
import { CourseProgressionMode } from '@prisma/client';

export class CreateCourseDto {
  @ApiProperty({ example: 'Introduction to Web Development', maxLength: 160 })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @ApiProperty({ example: 'Learn the fundamentals of HTML, CSS and JavaScript.' })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiPropertyOptional({
    description:
      'Cover image URL. Pasting a link still works; uploading an image through POST /{tutor|master}/courses/:id/thumbnail overwrites it.',
  })
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    enum: CourseProgressionMode,
    default: CourseProgressionMode.FREE,
    description:
      'FREE: lessons can be taken in any order. SEQUENTIAL: a lesson unlocks only once every earlier lesson is complete.',
  })
  @IsOptional()
  @IsEnum(CourseProgressionMode)
  progressionMode?: CourseProgressionMode;

  @ApiPropertyOptional({
    description:
      'Master only: Tutor id (Tutor.id) who will own the course; omit to leave it unassigned. Ignored for tutors, who always own their own courses.',
  })
  @IsOptional()
  @IsUUID()
  tutorId?: string;
}
