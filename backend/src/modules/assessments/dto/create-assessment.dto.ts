import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssessmentType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateAssessmentDto {
  @ApiProperty({
    enum: AssessmentType,
    description: 'MCQ is auto-graded on submit; DOCUMENT hands out a question paper for a tutor to grade.',
  })
  @IsEnum(AssessmentType)
  type: AssessmentType;

  @ApiProperty({ example: 'Unit IG1 — element 1 knowledge check' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiPropertyOptional({ description: 'What the student is told before starting. Markdown.' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ default: 70, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passPercent?: number;

  @ApiPropertyOptional({ description: 'MCQ only. Omit for an untimed assessment.', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitMinutes?: number;
}
