import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryStudyMaterialDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only list the study materials of this course' })
  @IsOptional()
  @IsUUID()
  courseId?: string;
}
