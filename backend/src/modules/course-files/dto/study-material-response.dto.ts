import { ApiProperty } from '@nestjs/swagger';

export class StudyMaterialUploaderDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
}

export class StudyMaterialResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'Display name of the resource (e.g. the book title)' })
  title: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() courseId: string;
  @ApiProperty() courseTitle: string;
  @ApiProperty() originalName: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty({ type: StudyMaterialUploaderDto, nullable: true })
  uploadedBy: StudyMaterialUploaderDto | null;
  @ApiProperty({
    description: 'POST this to obtain a short-lived URL the browser can open directly',
  })
  streamUrlEndpoint: string;
  @ApiProperty() createdAt: Date;
}
