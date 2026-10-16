import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class DeactivateCourseDto {
  @ApiProperty({ description: 'Shown to the tutor while the course is locked', minLength: 3, maxLength: 500 })
  @IsString()
  @Length(3, 500)
  reason: string;
}
