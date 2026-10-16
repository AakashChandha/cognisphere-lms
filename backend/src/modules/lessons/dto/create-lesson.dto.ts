import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ example: 'Setting up your development environment' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiPropertyOptional({
    example: '## Why manage health and safety?\n\nThree reasons: moral, legal and financial...',
    description: 'Lesson notes in Markdown. Optional, so a video-only lesson needs no filler text.',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Position within the course, defaults to next available' })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
