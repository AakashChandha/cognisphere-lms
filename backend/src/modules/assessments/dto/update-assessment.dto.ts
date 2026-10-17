import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, MinLength, ValidateIf } from 'class-validator';

export class UpdateAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional({ description: 'Markdown shown to the student before starting' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passPercent?: number;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 1,
    description: 'Send null to make a timed assessment untimed again.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateAssessmentDto) => dto.timeLimitMinutes !== null)
  @IsInt()
  @Min(1)
  timeLimitMinutes?: number | null;
}
