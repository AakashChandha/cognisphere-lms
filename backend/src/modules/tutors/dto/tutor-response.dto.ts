import { ApiProperty } from '@nestjs/swagger';

export class TutorResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty({ nullable: true }) expertise: string | null;
  @ApiProperty({ nullable: true }) avatarUrl: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() coursesCount: number;
  @ApiProperty() createdAt: Date;
}
