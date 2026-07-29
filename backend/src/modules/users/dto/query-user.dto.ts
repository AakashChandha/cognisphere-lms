import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { AppRole } from '../../../common/constants/roles.constant';

export class QueryUserDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AppRole })
  @IsOptional()
  @IsEnum(AppRole)
  role?: AppRole;
}
