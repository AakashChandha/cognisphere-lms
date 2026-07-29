import { ApiProperty } from '@nestjs/swagger';
import { AppRole } from '../../../common/constants/roles.constant';

export class ProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ nullable: true }) avatarUrl: string | null;
  @ApiProperty({ enum: AppRole, isArray: true }) roles: AppRole[];
  @ApiProperty({ nullable: true }) phone?: string | null;
  @ApiProperty({ nullable: true }) bio?: string | null;
  @ApiProperty({ nullable: true }) expertise?: string | null;
  @ApiProperty() createdAt: Date;
}
