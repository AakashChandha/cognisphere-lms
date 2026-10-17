import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderQuestionsDto {
  @ApiProperty({
    type: [String],
    description: 'Every question id of the assessment in the desired order (first = position 0)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  questionIds: string[];
}
