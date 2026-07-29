import { ApiProperty } from '@nestjs/swagger';
import { AppRole } from '../../../common/constants/roles.constant';

/**
 * Public-facing user shape. Never exposes `passwordHash` or other internal
 * database fields, satisfying the "never expose database models" rule.
 */
export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ nullable: true }) avatarUrl: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ enum: AppRole, isArray: true }) roles: AppRole[];
  @ApiProperty() createdAt: Date;
}
