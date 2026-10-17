import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { CourseProgressionMode } from '@prisma/client';

export class UpdateCourseDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @ApiPropertyOptional({ description: 'Cover image URL; pasting a link still works' })
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    enum: CourseProgressionMode,
    description: 'FREE: lessons in any order. SEQUENTIAL: each lesson unlocks the next.',
  })
  @IsOptional()
  @IsEnum(CourseProgressionMode)
  progressionMode?: CourseProgressionMode;
}
