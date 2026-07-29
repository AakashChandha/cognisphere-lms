import { ApiProperty } from '@nestjs/swagger';

export class CourseFileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty({ nullable: true }) lessonId: string | null;
  @ApiProperty() originalName: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty() downloadUrl: string;
  @ApiProperty() createdAt: Date;
}
