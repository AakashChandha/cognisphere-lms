import { ApiProperty } from '@nestjs/swagger';
import { AnnouncementAudience } from '@prisma/client';

export class AnnouncementResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() content: string;
  @ApiProperty({ enum: AnnouncementAudience }) audience: AnnouncementAudience;
  @ApiProperty({ nullable: true }) courseId: string | null;
  @ApiProperty({ nullable: true }) courseTitle: string | null;
  @ApiProperty() authorId: string;
  @ApiProperty() authorName: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
