import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateCourseFileDto {
  @ApiPropertyOptional({
    description: 'Lesson to attach the file to; send null to make it a course-wide resource',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  lessonId?: string | null;
}
