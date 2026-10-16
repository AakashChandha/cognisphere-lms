import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderLessonsDto {
  @ApiProperty({
    type: [String],
    description: 'Every lesson id of the course in the desired order (first = position 0)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  lessonIds: string[];
}
