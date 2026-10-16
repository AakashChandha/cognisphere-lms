import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsUrl, MaxLength, MinLength } from 'class-validator';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    description:
      'Master only: Tutor id (Tutor.id) who will own the course; omit to leave it unassigned. Ignored for tutors, who always own their own courses.',
  })
  @IsOptional()
  @IsUUID()
  tutorId?: string;
}
