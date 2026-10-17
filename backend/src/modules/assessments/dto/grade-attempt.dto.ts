import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class GradeAttemptDto {
  @ApiProperty({ description: 'true marks the attempt PASSED, false FAILED' })
  @IsBoolean()
  passed: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, description: 'Optional numeric mark out of 100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scorePercent?: number;

  @ApiProperty({ description: 'What the student is told about this attempt' })
  @IsString()
  @MaxLength(5000)
  feedback: string;
}
