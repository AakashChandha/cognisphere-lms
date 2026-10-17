import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * List filters shared by the student, tutor and master inboxes. `search`
 * comes from `PaginationQueryDto`: it matches the title on the student side,
 * and the title or the student's name/email on the staff side.
 */
export class QueryQueriesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: QueryStatus, description: 'Only threads in this state' })
  @IsOptional()
  @IsEnum(QueryStatus)
  status?: QueryStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only threads on this course' })
  @IsOptional()
  @IsUUID()
  courseId?: string;
}
