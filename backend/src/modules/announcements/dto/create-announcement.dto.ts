import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementAudience } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Final exam schedule released' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'The final exam will take place on...' })
  @IsString()
  @MinLength(5)
  content: string;

  @ApiPropertyOptional({ enum: AnnouncementAudience, default: AnnouncementAudience.ALL })
  @IsOptional()
  @IsEnum(AnnouncementAudience)
  audience?: AnnouncementAudience;

  @ApiPropertyOptional({ description: 'Scope the announcement to a single course' })
  @IsOptional()
  @IsUUID()
  courseId?: string;
}
