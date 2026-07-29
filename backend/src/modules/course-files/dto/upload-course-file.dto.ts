import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UploadCourseFileDto {
  @ApiPropertyOptional({ description: 'Optional lesson id to attach the file to' })
  @IsOptional()
  @IsUUID()
  lessonId?: string;
}
