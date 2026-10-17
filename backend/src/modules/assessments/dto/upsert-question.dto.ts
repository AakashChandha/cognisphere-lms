import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class QuestionOptionInputDto {
  @ApiProperty({ example: 'A written risk assessment' })
  @IsString()
  @MinLength(1)
  text: string;

  @ApiProperty({ description: 'Exactly one option of a question must be the correct one.' })
  @IsBoolean()
  isCorrect: boolean;
}

/**
 * Used for both create and update: an update replaces the whole option set,
 * which is the only sane way to edit a question whose options carry the
 * answer key.
 */
export class UpsertQuestionDto {
  @ApiProperty({ example: 'Which document records the findings of a risk assessment?' })
  @IsString()
  @MinLength(1)
  prompt: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100, description: 'Weight in the score' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  points?: number;

  @ApiProperty({ type: [QuestionOptionInputDto], description: 'At least two, exactly one correct' })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options: QuestionOptionInputDto[];
}
