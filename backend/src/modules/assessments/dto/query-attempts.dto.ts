import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryAttemptsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AttemptStatus, description: 'Only attempts in this state' })
  @IsOptional()
  @IsEnum(AttemptStatus)
  status?: AttemptStatus;
}
