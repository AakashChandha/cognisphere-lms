import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AppRole } from '../../../common/constants/roles.constant';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: AppRole, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AppRole, { each: true })
  roles?: AppRole[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
