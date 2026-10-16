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
  @ApiProperty({
    description: 'GET this to obtain a short-lived URL the browser can open directly (video/PDF playback)',
  })
  streamUrlEndpoint: string;
  @ApiProperty() createdAt: Date;
}
